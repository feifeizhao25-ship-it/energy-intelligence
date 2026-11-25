from typing import Union

from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas.finance import (
    LCOERequest, SolarFinanceRequest, WindFinanceRequest, FinancialModelResponse,
    StorageFinanceRequest, StorageFinanceResponse,
)
from app.utils.response import success
from app.utils.financial_utils import (
    calc_irr, calc_npv, calc_lcoe, build_solar_cashflows, build_wind_cashflows, min_solar_dscr,
)
from app.core.dependencies import get_current_user_id
from app.core.database import get_db

router = APIRouter(prefix="/finance")


STORAGE_USER_FIELDS = (
    "capacity_mwh", "power_mw", "cycles_per_year", "peak_price_per_mwh", "offpeak_price_per_mwh", "capex_per_kwh",
    "roundtrip_efficiency", "annual_degradation_rate", "annual_opex_rate", "discount_rate", "project_life",
)
# Engine defaults are placeholders, not evidence. A saved model says which numbers the person entered.
STORAGE_DEFAULTED = ("roundtrip_efficiency", "annual_degradation_rate", "annual_opex_rate", "discount_rate", "project_life")


def storage_model(body: StorageFinanceRequest) -> dict:
    """Auditable storage-arbitrage maths from explicit assumptions only (shared by /storage and saved models).

    Net revenue is discharged energy times the peak price, minus charged energy times the off-peak price.
    Charged energy is discharged energy divided by round-trip efficiency, so a round trip buys more
    electricity than it sells. Payback is null when the project does not recover its cost within its life.
    """
    if body.peak_price_per_mwh <= body.offpeak_price_per_mwh:
        raise HTTPException(status_code=422, detail="峰时电价必须高于谷时电价")
    total_capex = body.capacity_mwh * 1000 * body.capex_per_kwh
    annual_opex = total_capex * body.annual_opex_rate
    price_spread = body.peak_price_per_mwh - body.offpeak_price_per_mwh
    initial_discharged = body.capacity_mwh * body.cycles_per_year * body.roundtrip_efficiency
    initial_charged = initial_discharged / body.roundtrip_efficiency
    cashflows = [-total_capex]
    discharged_energy = []
    charged_energy = []
    for year in range(body.project_life):
        retained_capacity = max(0.0, 1 - body.annual_degradation_rate * year)
        discharged = initial_discharged * retained_capacity
        charged = discharged / body.roundtrip_efficiency
        discharged_energy.append(discharged)
        charged_energy.append(charged)
        cashflows.append(discharged * body.peak_price_per_mwh - charged * body.offpeak_price_per_mwh - annual_opex)

    irr = calc_irr(cashflows)
    npv = calc_npv(body.discount_rate, cashflows)
    cumulative = -total_capex
    payback = None
    for year, cashflow in enumerate(cashflows[1:], start=1):
        previous = cumulative
        cumulative += cashflow
        if cumulative >= 0 and cashflow > 0:
            payback = (year - 1) + (-previous / cashflow)
            break
    discounted_costs = total_capex + sum(
        annual_opex / ((1 + body.discount_rate) ** year) for year in range(1, body.project_life + 1)
    )
    discounted_charging = sum(
        charged * body.offpeak_price_per_mwh / ((1 + body.discount_rate) ** year)
        for year, charged in enumerate(charged_energy, start=1)
    )
    discounted_energy = sum(
        energy / ((1 + body.discount_rate) ** year) for year, energy in enumerate(discharged_energy, start=1)
    )
    lcos_excluding = discounted_costs / discounted_energy if discounted_energy > 0 else 0
    lcos_including = (discounted_costs + discounted_charging) / discounted_energy if discounted_energy > 0 else 0
    return dict(
        total_capex=total_capex, annual_opex=annual_opex, price_spread=price_spread,
        initial_discharged=initial_discharged, initial_charged=initial_charged,
        cashflows=cashflows, irr=irr, npv=npv,
        payback=payback, lcos=lcos_excluding, lcos_excluding=lcos_excluding, lcos_including=lcos_including,
    )


def storage_response(body: StorageFinanceRequest, en: bool) -> StorageFinanceResponse:
    """Shared by the storage endpoint and the saved-model path."""
    m = storage_model(body)
    irr, npv, payback = m["irr"], m["npv"], m["payback"]
    net_revenue = m["initial_discharged"] * body.peak_price_per_mwh - m["initial_charged"] * body.offpeak_price_per_mwh
    formula = (
        "Net revenue = discharged MWh × peak price − charged MWh × off-peak price. "
        "Charged MWh = discharged MWh / round-trip efficiency."
        if en else
        "净收入 = 放电量 × 峰时电价 − 充电量 × 谷时电价。充电量 = 放电量 / 往返效率。"
    )
    not_counted = "not included" if en else "未计"
    lcos_note = (
        "lcos excludes charging electricity. lcos_including_charging_cost includes it."
        if en else
        "lcos 不含充电电费。lcos_including_charging_cost 含充电电费。"
    )
    return StorageFinanceResponse(
        irr=None if irr is None else round(float(irr), 4),
        npv=round(float(npv), 2),
        lcos=round(m["lcos_excluding"], 4),
        lcos_excluding_charging_cost=round(m["lcos_excluding"], 4),
        lcos_including_charging_cost=round(m["lcos_including"], 4),
        payback_years=None if payback is None else round(float(payback), 2),
        annual_revenue=round(net_revenue, 2),
        annual_discharged_mwh=round(m["initial_discharged"], 2),
        annual_charged_mwh=round(m["initial_charged"], 2),
        total_capex=round(m["total_capex"], 2),
        cashflows=[round(value, 2) for value in m["cashflows"][1:]],
        assumption_version="storage-arbitrage-v1.1",
        assumptions={
            "source": "user_input",
            "roundtrip_efficiency": body.roundtrip_efficiency,
            "annual_degradation_rate": body.annual_degradation_rate,
            "annual_opex_rate": body.annual_opex_rate,
            "discount_rate": body.discount_rate,
            "project_life": body.project_life,
            "currency": body.currency,
            "revenue_formula": formula,
            "tax": not_counted,
            "battery_replacement": not_counted,
            "lcos": lcos_note,
            "payback": "null when the cost is not recovered within the project life" if en else "寿命期内无法回收时为空",
        },
    )


@router.post("/storage", response_model=StorageFinanceResponse)
async def storage_finance(
    body: StorageFinanceRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Auditable storage-arbitrage model based solely on explicit user assumptions."""
    return storage_response(body, await _user_is_global(db, user_id))


@router.post("/lcoe")
async def lcoe_finance(
    body: LCOERequest,
    user_id: str = Depends(get_current_user_id),
):
    """Levelized cost from the shared calc_lcoe formula. Currency labels the unit only."""
    value = calc_lcoe(
        body.capex,
        body.annual_opex,
        body.annual_gen_kwh,
        discount_rate=body.discount_rate,
        project_life=body.lifetime,
        degradation_rate=body.degradation,
    )
    return success(data={"lcoe": value, "unit": f"{body.currency}/kWh"})


def power_metrics(body, *, wind: bool, en: bool) -> dict:
    """Same engine for the solar and wind endpoints, comparison and saved models."""
    from app.utils.financial_utils import evaluate_power_project

    sent = set(getattr(body, "model_fields_set", set()))
    metrics = evaluate_power_project(
        capacity_mw=body.capacity_mw,
        capex_per_w=(body.capex_per_kw / 1000) if wind else body.capex_per_w,
        opex_per_kw_yr=body.opex_per_kw_yr,
        electricity_price=body.electricity_price,
        itc_rate=0 if wind else body.itc_rate,
        capacity_factor=body.wind_capacity_factor if wind else body.capacity_factor,
        degradation_rate=body.degradation_rate,
        debt_ratio=body.debt_ratio,
        interest_rate=body.interest_rate,
        tax_rate=body.tax_rate,
        project_life=body.project_life,
        currency=body.currency,
        discount_rate=body.discount_rate,
        depreciation_method=body.depreciation_method,
        depreciation_years=body.depreciation_years,
        residual_rate=body.residual_rate,
        itc_basis_reduction=None if wind else body.itc_basis_reduction,
        ptc_per_mwh=body.ptc_per_mwh if wind else 0.0,
        en=en,
        kind="wind" if wind else "solar",
        discount_rate_defaulted="discount_rate" not in sent,
    )
    metrics["input_notes"] = body.notes_for(en)
    return metrics


def _response_from_metrics(metrics: dict) -> FinancialModelResponse:
    payload = {key: value for key, value in metrics.items() if key != "equity_cashflows_with_investment"}
    return FinancialModelResponse(**payload)


@router.post("/solar", response_model=FinancialModelResponse)
async def solar_finance(
    body: SolarFinanceRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Calculate financial metrics for solar project."""
    return _response_from_metrics(power_metrics(body, wind=False, en=await _user_is_global(db, user_id)))


@router.post("/wind", response_model=FinancialModelResponse)
async def wind_finance(
    body: WindFinanceRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Calculate financial metrics for wind project."""
    return _response_from_metrics(power_metrics(body, wind=True, en=await _user_is_global(db, user_id)))


@router.post("/compare")
async def compare_scenarios(
    scenarios: list = Body(..., embed=True),
    user_id: str = Depends(get_current_user_id),
):
    """Compare multiple financial scenarios side-by-side."""
    from app.schemas.finance import SolarFinanceRequest, WindFinanceRequest

    results = []
    for i, scenario in enumerate(scenarios):
        wind = scenario.get("type", "solar") != "solar"
        req = WindFinanceRequest(**scenario) if wind else SolarFinanceRequest(**scenario)
        metrics = power_metrics(req, wind=wind, en=req.currency.upper() != "CNY")
        payback = metrics["payback_years"]
        results.append({
            "scenario_id": i + 1,
            "name": scenario.get("name", f"Scenario {i+1}"),
            "irr": None if metrics["irr"] is None else round(metrics["irr"], 2),
            "equity_irr": None if metrics["equity_irr"] is None else round(metrics["equity_irr"], 2),
            "npv": round(metrics["npv"], 2),
            "lcoe": round(metrics["lcoe"], 4),
            "payback_years": None if payback is None else round(payback, 1),
        })

    # Sort by IRR descending; scenarios without a unique IRR stay last.
    results.sort(key=lambda x: (x["irr"] is not None, x["irr"] or 0), reverse=True)
    return {"comparison": results, "best": results[0]["name"] if results else None}


@router.get("/models/{project_id}")
async def get_financial_models(
    project_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get all financial models for a project."""
    from sqlalchemy import select
    from app.models.database import FinancialModel, Project

    # Verify project belongs to user
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.user_id == user_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")

    result = await db.execute(
        select(FinancialModel).where(FinancialModel.project_id == project_id)
    )
    models = result.scalars().all()
    return {"models": [m for m in models]}

@router.post("/models/{project_id}")
async def save_financial_model(
    project_id: str,
    body: Union[StorageFinanceRequest, SolarFinanceRequest, WindFinanceRequest],
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Save a financial model for a project (solar, wind or storage)."""
    from sqlalchemy import select
    from app.models.database import FinancialModel, Project
    import uuid
    from datetime import datetime, timezone

    # Verify project belongs to user
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.user_id == user_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")

    if isinstance(body, StorageFinanceRequest):
        return await _save_storage_model(db, project_id, body, user_id)

    is_solar = hasattr(body, 'capex_per_w')
    scenario_name = getattr(body, 'name', None) if hasattr(body, 'name') else None
    en = await _user_is_global(db, user_id)
    metrics = power_metrics(body, wind=not is_solar, en=en)
    price_mwh = round(float(body.electricity_price), 6)
    price_kwh = round(price_mwh / 1000.0, 8)
    capex_per_w = body.capex_per_w if is_solar else body.capex_per_kw / 1000
    investment = body.capacity_mw * 1_000_000 * capex_per_w
    opex_year = body.capacity_mw * 1000 * body.opex_per_kw_yr
    annual_gen_kwh = body.capacity_mw * 1000 * 8760 * (body.capacity_factor if is_solar else body.wind_capacity_factor)
    series = [float(c) for c in metrics["equity_cashflows_with_investment"]]
    engine = {
        "source": "finance_engine",
        "irr_unit": "percent",
        "irr": metrics["irr"],
        "npv": metrics["npv"],
        "lcoe": metrics["lcoe"],
        "payback_years": metrics["payback_years"],
        "equity_irr": metrics["equity_irr"],
        "project_irr_pretax": metrics["project_irr_pretax"],
        "replay": {
            "kind": "solar" if is_solar else "wind",
            "electricity_price_per_mwh": price_mwh,
            "electricity_price_per_kwh": price_kwh,
        },
    }

    model = FinancialModel(
        id=str(uuid.uuid4()),
        project_id=project_id,
        scenario_name=scenario_name or "Default",
        capacity_mw=body.capacity_mw,
        capex_per_w=getattr(body, 'capex_per_w', None),
        opex_per_kw_yr=body.opex_per_kw_yr,
        electricity_price=price_mwh,
        irr=None if metrics["irr"] is None else round(metrics["irr"], 4),
        npv=round(metrics["npv"], 2),
        lcoe=round(metrics["lcoe"], 4),
        payback_years=None if metrics["payback_years"] is None else round(metrics["payback_years"], 4),
        capacity_factor=getattr(body, 'capacity_factor', None) or getattr(body, 'wind_capacity_factor', None),
        created_at=datetime.now(timezone.utc),
    )
    db.add(model)

    # Also keep what the report generator reads: inputs, the cash-flow series and the sources.
    # The report reuses these engine figures instead of calculating a second set.
    from app.models.cashflow import CashflowProjection

    db.add(CashflowProjection(
        id=str(uuid.uuid4()),
        project_id=project_id,
        scenario_name=scenario_name or "Default",
        yearly_cashflows={
            "assumptions": {
                "initial_investment": float(investment),
                "project_life_years": body.project_life,
                "discount_rate": body.discount_rate,
                "annual_generation_mwh": float(annual_gen_kwh / 1000),
                "electricity_price": price_kwh,
                "electricity_price_unit": "per_kwh",
                "opex_annual": float(opex_year),
                "currency": body.currency,
                "finance_engine": engine,
                "input_origin": "user_provided",
            },
            "values": series,
            "sources": [
                {**dict(src), "origin": "user_provided", "type": src.get("type") or "user_provided"}
                for src in (body.data_sources or []) if isinstance(src, dict)
            ],
        },
        irr=model.irr, npv=model.npv, lcoe=model.lcoe, payback_years=model.payback_years,
        created_at=datetime.now(timezone.utc),
    ))
    await db.flush()
    await db.refresh(model)
    return model


# ── Report data sources (evidence the user registers for a project's reports) ──────────────────
MAX_REPORT_SOURCES = 30
_SOURCE_TEXT_LIMITS = {"title": 200, "url": 500, "publisher": 120, "published_at": 32, "retrieved_at": 32, "type": 40, "locator": 120}


async def _user_is_global(db, user_id: str) -> bool:
    """The international edition is a property of the account (User.market), set at registration."""
    from sqlalchemy import select
    from app.models.user import User

    market = await db.scalar(select(User.market).where(User.id == user_id))
    return (market or "cn") == "global"


def clean_report_sources(raw, en: bool):
    from datetime import date
    """Validate user-entered sources. Returns a list of normalised dicts or raises 422 in the user's language."""
    def fail(zh: str, eng: str):
        raise HTTPException(status_code=422, detail=eng if en else zh)

    if not isinstance(raw, list):
        fail("sources 必须是列表", "sources must be a list")
    if len(raw) > MAX_REPORT_SOURCES:
        fail(f"最多登记 {MAX_REPORT_SOURCES} 条来源", f"At most {MAX_REPORT_SOURCES} sources can be registered")
    out, seen = [], set()
    for i, item in enumerate(raw, start=1):
        if not isinstance(item, dict):
            fail(f"第 {i} 条来源格式不正确", f"Source {i} is not valid")
        row = {}
        for key, limit in _SOURCE_TEXT_LIMITS.items():
            value = item.get(key)
            if value is None or str(value).strip() == "":
                continue
            value = str(value).strip()
            if len(value) > limit:
                fail(f"第 {i} 条来源的“{key}”超过 {limit} 字", f"Source {i}: '{key}' is longer than {limit} characters")
            row[key] = value
        if not row.get("title"):
            fail(f"第 {i} 条来源缺少标题", f"Source {i} needs a title")
        url = row.get("url")
        if url and not url.lower().startswith(("http://", "https://")):
            fail(f"第 {i} 条来源的链接必须以 http:// 或 https:// 开头", f"Source {i}: the link must start with http:// or https://")
        row.setdefault("retrieved_at", date.today().isoformat())  # the day the person registered it
        row["origin"] = "user_provided"
        row.setdefault("type", "user_provided")
        key = (row["title"].lower(), (url or "").lower())
        if key in seen:
            continue
        seen.add(key)
        out.append(row)
    return out


async def _latest_cashflow(db, project_id: str, user_id: str, en: bool):
    from sqlalchemy import select
    from app.models.cashflow import CashflowProjection
    from app.models.database import Project

    owned = await db.execute(select(Project).where(Project.id == project_id, Project.user_id == user_id))
    if not owned.scalar_one_or_none():
        raise HTTPException(status_code=404, detail=("Project not found" if en else "项目不存在"))
    cf = (await db.execute(
        select(CashflowProjection).where(CashflowProjection.project_id == project_id)
        .order_by(CashflowProjection.created_at.desc()).limit(1)
    )).scalar_one_or_none()
    return cf


@router.get("/data-sources/{project_id}")
async def get_report_data_sources(
    project_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Sources currently attached to the project's latest financial model (what reports cite)."""
    en = await _user_is_global(db, user_id)
    cf = await _latest_cashflow(db, project_id, user_id, en)
    payload = cf.yearly_cashflows if cf is not None and isinstance(cf.yearly_cashflows, dict) else {}
    return {"project_id": project_id, "has_financial_model": cf is not None, "sources": list(payload.get("sources") or [])}


@router.put("/data-sources/{project_id}")
async def put_report_data_sources(
    project_id: str,
    body: dict = Body(...),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Replace the sources attached to the project's latest financial model.

    A report can only cite what a person registered here; nothing is invented. The project needs a
    saved financial model first because that is where the report reads its inputs."""
    en = await _user_is_global(db, user_id)
    cf = await _latest_cashflow(db, project_id, user_id, en)
    if cf is None or not isinstance(cf.yearly_cashflows, dict):
        raise HTTPException(
            status_code=409,
            detail=("Save a financial model for this project first, then add its data sources." if en
                    else "请先为该项目保存财务模型，再登记数据来源"),
        )
    sources = clean_report_sources(body.get("sources"), en)
    payload = dict(cf.yearly_cashflows)
    payload["sources"] = sources
    cf.yearly_cashflows = payload  # reassign so the JSON column is flagged dirty
    await db.flush()
    return {"project_id": project_id, "has_financial_model": True, "sources": sources, "count": len(sources)}


async def _save_storage_model(db, project_id: str, body: StorageFinanceRequest, user_id: str):
    """Persist a storage-arbitrage model using the same figures as /finance/storage.

    Net revenue is discharged energy times the peak price minus charged energy times the off-peak price.
    Charged energy is discharged energy divided by round-trip efficiency. Sources come only from
    ``data_sources``. Nothing is looked up or invented."""
    import uuid
    from datetime import datetime, timezone
    from app.models.cashflow import CashflowProjection
    from app.models.database import FinancialModel

    en = await _user_is_global(db, user_id)
    shown = storage_response(body, en)
    m = storage_model(body)
    sources = clean_report_sources(body.data_sources, en) if body.data_sources else []
    given = set(getattr(body, "model_fields_set", set()))
    provenance = {f: ("user_input" if f in given else "engine_default_not_sourced") for f in STORAGE_USER_FIELDS}
    model = FinancialModel(
        id=str(uuid.uuid4()), project_id=project_id, scenario_name="Storage arbitrage",
        capacity_mw=body.power_mw, capex_per_w=None,
        opex_per_kw_yr=round(m["annual_opex"] / (body.power_mw * 1000), 4),
        electricity_price=round(m["price_spread"], 6),
        irr=shown.irr, npv=shown.npv, lcoe=shown.lcos,
        payback_years=shown.payback_years, capacity_factor=None,
        created_at=datetime.now(timezone.utc),
    )
    db.add(model)
    db.add(CashflowProjection(
        id=str(uuid.uuid4()), project_id=project_id, scenario_name="Storage arbitrage",
        yearly_cashflows={
            "assumptions": {
                "initial_investment": float(m["total_capex"]),
                "project_life_years": body.project_life,
                "discount_rate": body.discount_rate,
                "annual_generation_mwh": float(m["initial_discharged"]),
                "annual_charged_mwh": float(m["initial_charged"]),
                "annual_net_revenue": shown.annual_revenue,
                "electricity_price": round(float(m["price_spread"]) / 1000, 8),
                "opex_annual": float(m["annual_opex"]),
                "currency": body.currency,
                "model_type": "storage_arbitrage",
                "assumption_provenance": provenance,
                "defaulted_assumptions": [f for f in STORAGE_DEFAULTED if provenance[f] != "user_input"],
                "input_origin": "user_provided",
                "finance_engine": {
                    "source": "finance_engine",
                    "irr_unit": "percent",
                    "irr": shown.irr,
                    "npv": shown.npv,
                    "lcoe": shown.lcos,
                    "payback_years": shown.payback_years,
                },
            },
            "values": [float(c) for c in m["cashflows"]],
            "sources": sources,
        },
        irr=model.irr, npv=model.npv, lcoe=model.lcoe, payback_years=model.payback_years,
        created_at=datetime.now(timezone.utc),
    ))
    await db.flush()
    await db.refresh(model)
    return model
