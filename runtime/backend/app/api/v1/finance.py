from typing import Union

from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas.finance import (
    SolarFinanceRequest, WindFinanceRequest, FinancialModelResponse,
    StorageFinanceRequest, StorageFinanceResponse,
)
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
    """Auditable storage-arbitrage maths from explicit assumptions only (shared by /storage and saved models)."""
    if body.peak_price_per_mwh <= body.offpeak_price_per_mwh:
        raise HTTPException(status_code=422, detail="峰时电价必须高于谷时电价")
    total_capex = body.capacity_mwh * 1000 * body.capex_per_kwh
    annual_opex = total_capex * body.annual_opex_rate
    price_spread = body.peak_price_per_mwh - body.offpeak_price_per_mwh
    initial_discharged = body.capacity_mwh * body.cycles_per_year * body.roundtrip_efficiency
    cashflows = [-total_capex]
    discharged_energy = []
    for year in range(body.project_life):
        retained_capacity = max(0.0, 1 - body.annual_degradation_rate * year)
        discharged = initial_discharged * retained_capacity
        discharged_energy.append(discharged)
        cashflows.append(discharged * price_spread - annual_opex)

    irr = calc_irr(cashflows)
    npv = calc_npv(body.discount_rate, cashflows)
    cumulative = -total_capex
    payback = 99.0
    for year, cashflow in enumerate(cashflows[1:], start=1):
        previous = cumulative
        cumulative += cashflow
        if cumulative >= 0 and cashflow > 0:
            payback = (year - 1) + (-previous / cashflow)
            break
    discounted_costs = total_capex + sum(
        annual_opex / ((1 + body.discount_rate) ** year) for year in range(1, body.project_life + 1)
    )
    discounted_energy = sum(
        energy / ((1 + body.discount_rate) ** year) for year, energy in enumerate(discharged_energy, start=1)
    )
    lcos = discounted_costs / discounted_energy if discounted_energy > 0 else 0
    return dict(
        total_capex=total_capex, annual_opex=annual_opex, price_spread=price_spread,
        initial_discharged=initial_discharged, cashflows=cashflows, irr=irr, npv=npv,
        payback=payback, lcos=lcos,
    )


@router.post("/storage", response_model=StorageFinanceResponse)
async def storage_finance(
    body: StorageFinanceRequest,
    user_id: str = Depends(get_current_user_id),
):
    """Auditable storage-arbitrage model based solely on explicit user assumptions."""
    m = storage_model(body)
    irr, npv, lcos, payback = m["irr"], m["npv"], m["lcos"], m["payback"]
    initial_discharged, total_capex, price_spread, cashflows = (
        m["initial_discharged"], m["total_capex"], m["price_spread"], m["cashflows"])

    return StorageFinanceResponse(
        irr=None if irr is None else round(float(irr), 4), npv=round(float(npv), 2), lcos=round(lcos, 4),
        payback_years=round(min(payback, 99.0), 2),
        annual_revenue=round(initial_discharged * price_spread, 2),
        annual_discharged_mwh=round(initial_discharged, 2), total_capex=round(total_capex, 2),
        cashflows=[round(value, 2) for value in cashflows[1:]],
        assumption_version="storage-arbitrage-v1.0",
        assumptions={
            "source": "user_input",
            "roundtrip_efficiency": body.roundtrip_efficiency,
            "annual_degradation_rate": body.annual_degradation_rate,
            "annual_opex_rate": body.annual_opex_rate,
            "discount_rate": body.discount_rate,
            "project_life": body.project_life,
            "currency": body.currency,
        },
    )


@router.post("/solar", response_model=FinancialModelResponse)
async def solar_finance(
    body: SolarFinanceRequest,
    user_id: str = Depends(get_current_user_id),
):
    """Calculate financial metrics for solar project."""
    cashflows = build_solar_cashflows(
        capacity_mw=body.capacity_mw,
        capex_per_w=body.capex_per_w,
        opex_per_kw_yr=body.opex_per_kw_yr,
        electricity_price=body.electricity_price,
        itc_rate=body.itc_rate,
        capacity_factor=body.capacity_factor,
        degradation_rate=body.degradation_rate,
        debt_ratio=body.debt_ratio,
        interest_rate=body.interest_rate,
        tax_rate=body.tax_rate,
        project_life=body.project_life,
    )
    irr = calc_irr(cashflows)
    npv = calc_npv(0.08, cashflows)
    annual_gen = body.capacity_mw * 1000 * 8760 * body.capacity_factor
    capex_total = body.capacity_mw * 1_000_000 * body.capex_per_w
    opex_total = body.capacity_mw * 1000 * body.opex_per_kw_yr
    lcoe = calc_lcoe(
        capex_total, opex_total, annual_gen,
        degradation_rate=body.degradation_rate, project_life=body.project_life,
    )
    payback = next((i for i, cf in enumerate(cashflows) if sum(cashflows[:i+1]) > 0), 99)

    return FinancialModelResponse(
        irr=irr,
        npv=npv,
        lcoe=lcoe,
        payback_years=float(payback),
        equity_irr=irr,
        dscr_min=min_solar_dscr(
            capacity_mw=body.capacity_mw, capex_per_w=body.capex_per_w, opex_per_kw_yr=body.opex_per_kw_yr,
            electricity_price=body.electricity_price, itc_rate=body.itc_rate, capacity_factor=body.capacity_factor,
            degradation_rate=body.degradation_rate, debt_ratio=body.debt_ratio, interest_rate=body.interest_rate,
            tax_rate=body.tax_rate, project_life=body.project_life,
        ),
        cashflows=cashflows[1:],
        input_notes=body.price_notes,
        sensitivity={
            "capex_+10pct_irr": calc_irr(build_solar_cashflows(
                capacity_mw=body.capacity_mw, capex_per_w=body.capex_per_w * 1.1, opex_per_kw_yr=body.opex_per_kw_yr,
                electricity_price=body.electricity_price, itc_rate=body.itc_rate, capacity_factor=body.capacity_factor,
                degradation_rate=body.degradation_rate, debt_ratio=body.debt_ratio, interest_rate=body.interest_rate,
                tax_rate=body.tax_rate, project_life=body.project_life,
            )),
            "price_-10pct_irr": calc_irr(build_solar_cashflows(
                capacity_mw=body.capacity_mw, capex_per_w=body.capex_per_w, opex_per_kw_yr=body.opex_per_kw_yr,
                electricity_price=body.electricity_price * 0.9, itc_rate=body.itc_rate, capacity_factor=body.capacity_factor,
                degradation_rate=body.degradation_rate, debt_ratio=body.debt_ratio, interest_rate=body.interest_rate,
                tax_rate=body.tax_rate, project_life=body.project_life,
            )),
        },
    )


@router.post("/wind", response_model=FinancialModelResponse)
async def wind_finance(
    body: WindFinanceRequest,
    user_id: str = Depends(get_current_user_id),
):
    """Calculate financial metrics for wind project."""
    wind_kwargs = dict(
        capacity_mw=body.capacity_mw, capex_per_kw=body.capex_per_kw, opex_per_kw_yr=body.opex_per_kw_yr,
        electricity_price=body.electricity_price, wind_capacity_factor=body.wind_capacity_factor,
        debt_ratio=body.debt_ratio, interest_rate=body.interest_rate, tax_rate=body.tax_rate,
        project_life=body.project_life,
    )
    cashflows = build_wind_cashflows(**wind_kwargs)
    irr = calc_irr(cashflows)
    npv = calc_npv(0.08, cashflows)
    annual_gen = body.capacity_mw * 1000 * 8760 * body.wind_capacity_factor
    capex_total = body.capacity_mw * 1000 * body.capex_per_kw
    opex_total = body.capacity_mw * 1000 * body.opex_per_kw_yr
    lcoe = calc_lcoe(
        capex_total, opex_total, annual_gen,
        degradation_rate=0, project_life=body.project_life,
    )
    payback = next((i for i, cf in enumerate(cashflows) if sum(cashflows[:i + 1]) > 0), 99)
    return FinancialModelResponse(
        irr=irr,
        npv=npv,
        lcoe=lcoe,
        payback_years=float(payback),
        equity_irr=irr,
        dscr_min=min_solar_dscr(
            capacity_mw=body.capacity_mw, capex_per_w=body.capex_per_kw / 1000, opex_per_kw_yr=body.opex_per_kw_yr,
            electricity_price=body.electricity_price, itc_rate=0, capacity_factor=body.wind_capacity_factor,
            degradation_rate=0, debt_ratio=body.debt_ratio, interest_rate=body.interest_rate,
            tax_rate=body.tax_rate, project_life=body.project_life,
        ),
        cashflows=cashflows[1:],
        input_notes=body.price_notes,
        sensitivity={
            "capex_+10pct_irr": calc_irr(build_wind_cashflows(**{**wind_kwargs, "capex_per_kw": body.capex_per_kw * 1.1})),
            "price_-10pct_irr": calc_irr(build_wind_cashflows(**{**wind_kwargs, "electricity_price": body.electricity_price * 0.9})),
        },
    )


@router.post("/compare")
async def compare_scenarios(
    scenarios: list = Body(..., embed=True),
    user_id: str = Depends(get_current_user_id),
):
    """Compare multiple financial scenarios side-by-side."""
    from app.schemas.finance import SolarFinanceRequest, WindFinanceRequest, FinancialModelResponse
    from app.utils.financial_utils import calc_irr, calc_npv, calc_lcoe, build_solar_cashflows

    results = []
    for i, scenario in enumerate(scenarios):
        s_type = scenario.get("type", "solar")
        if s_type == "solar":
            req = SolarFinanceRequest(**scenario)
            cashflows = build_solar_cashflows(
                capacity_mw=req.capacity_mw,
                capex_per_w=req.capex_per_w,
                opex_per_kw_yr=req.opex_per_kw_yr,
                electricity_price=req.electricity_price,
                itc_rate=req.itc_rate,
                capacity_factor=req.capacity_factor,
                degradation_rate=req.degradation_rate,
                debt_ratio=req.debt_ratio,
                interest_rate=req.interest_rate,
                tax_rate=req.tax_rate,
                project_life=req.project_life,
            )
            irr = calc_irr(cashflows)
            npv = calc_npv(0.08, cashflows)
            annual_gen = req.capacity_mw * 1000 * 8760 * req.capacity_factor
            capex_total = req.capacity_mw * 1_000_000 * req.capex_per_w
            opex_total = req.capacity_mw * 1000 * req.opex_per_kw_yr
            lcoe = calc_lcoe(
                capex_total, opex_total, annual_gen,
                degradation_rate=req.degradation_rate, project_life=req.project_life,
            )
            payback = next((j for j, cf in enumerate(cashflows) if sum(cashflows[:j+1]) > 0), 99)
            results.append({
                "scenario_id": i + 1,
                "name": scenario.get("name", f"Scenario {i+1}"),
                "irr": None if irr is None else round(irr, 2),
                "npv": round(npv, 2),
                "lcoe": round(lcoe, 4),
                "payback_years": round(payback, 1),
            })
        else:
            req = WindFinanceRequest(**scenario)
            cashflows = build_wind_cashflows(
                capacity_mw=req.capacity_mw, capex_per_kw=req.capex_per_kw, opex_per_kw_yr=req.opex_per_kw_yr,
                electricity_price=req.electricity_price, wind_capacity_factor=req.wind_capacity_factor,
                debt_ratio=req.debt_ratio, interest_rate=req.interest_rate, tax_rate=req.tax_rate,
                project_life=req.project_life,
            )
            irr = calc_irr(cashflows)
            npv = calc_npv(0.08, cashflows)
            annual_gen = req.capacity_mw * 1000 * 8760 * req.wind_capacity_factor
            capex_total = req.capacity_mw * 1000 * req.capex_per_kw
            opex_total = req.capacity_mw * 1000 * req.opex_per_kw_yr
            lcoe = calc_lcoe(
                capex_total, opex_total, annual_gen,
                degradation_rate=0, project_life=req.project_life,
            )
            payback = next((j for j, cf in enumerate(cashflows) if sum(cashflows[:j+1]) > 0), 99)
            results.append({
                "scenario_id": i + 1,
                "name": scenario.get("name", f"Scenario {i+1}"),
                "irr": None if irr is None else round(irr, 2),
                "npv": round(npv, 2),
                "lcoe": round(lcoe, 4),
                "payback_years": round(payback, 1),
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

    # Build cashflows and compute metrics
    if is_solar:
        from app.utils.financial_utils import calc_irr, calc_npv, calc_lcoe, build_solar_cashflows
        cashflows = build_solar_cashflows(
            capacity_mw=body.capacity_mw,
            capex_per_w=body.capex_per_w,
            opex_per_kw_yr=body.opex_per_kw_yr,
            electricity_price=body.electricity_price,
            itc_rate=body.itc_rate,
            capacity_factor=body.capacity_factor,
            degradation_rate=body.degradation_rate,
            debt_ratio=body.debt_ratio,
            interest_rate=body.interest_rate,
            tax_rate=body.tax_rate,
            project_life=body.project_life,
        )
        irr = calc_irr(cashflows)
        npv = calc_npv(0.08, cashflows)
        capex_total = body.capacity_mw * 1_000_000 * body.capex_per_w
        opex_total = body.capacity_mw * 1000 * body.opex_per_kw_yr
        annual_gen = body.capacity_mw * 1000 * 8760 * body.capacity_factor
        lcoe = calc_lcoe(
            capex_total, opex_total, annual_gen,
            degradation_rate=body.degradation_rate, project_life=body.project_life,
        )
        payback = next((i for i, cf in enumerate(cashflows) if sum(cashflows[:i+1]) > 0), 99)
    else:
        req: WindFinanceRequest = body
        capex = req.capacity_mw * 1000 * req.capex_per_kw
        annual_gen = req.capacity_mw * 1000 * 8760 * req.wind_capacity_factor
        equity = capex * (1 - req.debt_ratio)
        annual_revenue = annual_gen * req.electricity_price / 1000
        annual_opex = req.capacity_mw * 1000 * req.opex_per_kw_yr
        annual_cashflow = annual_revenue - annual_opex
        payback = capex / annual_cashflow if annual_cashflow > 0 else 99
        npv = round(sum(annual_cashflow / (1.08 ** yr) for yr in range(1, req.project_life + 1)) - equity, 2)
        pv_energy = sum(annual_gen / (1.08 ** yr) for yr in range(1, req.project_life + 1))
        lcoe = round((capex + annual_opex * req.project_life) / pv_energy, 4) if pv_energy > 0 else 0.0
        irr = round((annual_cashflow / equity) * 100, 2) if equity > 0 else 0.0

    model = FinancialModel(
        id=str(uuid.uuid4()),
        project_id=project_id,
        scenario_name=scenario_name or "Default",
        capacity_mw=body.capacity_mw,
        capex_per_w=getattr(body, 'capex_per_w', None),
        opex_per_kw_yr=body.opex_per_kw_yr,
        electricity_price=body.electricity_price,
        irr=None if irr is None else round(irr, 2),  # no unique IRR -> null, not a 500
        npv=round(npv, 2),
        lcoe=round(lcoe, 4),
        payback_years=round(min(payback, 99), 1),
        capacity_factor=getattr(body, 'capacity_factor', None) or getattr(body, 'wind_capacity_factor', None),
        created_at=datetime.now(timezone.utc),
    )
    db.add(model)

    # Also keep what the report generator reads: inputs, the cash-flow series and the sources.
    # Without this a saved model could never be turned into a report (reports saw an empty project).
    from app.models.cashflow import CashflowProjection

    life = body.project_life
    if is_solar:
        series = [float(c) for c in cashflows]
        investment = capex_total
        opex_year = opex_total
        gen_mwh = annual_gen / 1000
    else:
        investment = capex
        opex_year = annual_opex
        gen_mwh = annual_gen / 1000
        series = [-float(capex)] + [float(annual_cashflow)] * life
    db.add(CashflowProjection(
        id=str(uuid.uuid4()),
        project_id=project_id,
        scenario_name=scenario_name or "Default",
        yearly_cashflows={
            "assumptions": {
                "initial_investment": float(investment),
                "project_life_years": life,
                "discount_rate": 0.08,
                "annual_generation_mwh": float(gen_mwh),
                "electricity_price": float(body.electricity_price) / 1000,  # per kWh in the report maths
                "opex_annual": float(opex_year),
                "currency": body.currency,
            },
            "values": series,
            "sources": [dict(src) for src in (body.data_sources or []) if isinstance(src, dict)],
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
    """Persist a storage-arbitrage model in the shape the report generator reads.

    Every figure is the person's own input: the saved assumptions record which numbers were entered and
    which are engine defaults ("not sourced"), and sources come only from ``data_sources``. Nothing is
    looked up or invented. For reports, annual energy is the year-1 discharged MWh and the price is the
    peak/off-peak spread, so revenue = energy x spread, exactly as the model computes it."""
    import uuid
    from datetime import datetime, timezone
    from app.models.cashflow import CashflowProjection
    from app.models.database import FinancialModel

    m = storage_model(body)
    sources = clean_report_sources(body.data_sources, await _user_is_global(db, user_id)) if body.data_sources else []
    irr = m["irr"]
    given = set(getattr(body, "model_fields_set", set()))
    provenance = {f: ("user_input" if f in given else "engine_default_not_sourced") for f in STORAGE_USER_FIELDS}
    model = FinancialModel(
        id=str(uuid.uuid4()), project_id=project_id, scenario_name="Storage arbitrage",
        capacity_mw=body.power_mw, capex_per_w=None,
        opex_per_kw_yr=round(m["annual_opex"] / (body.power_mw * 1000), 4),
        electricity_price=m["price_spread"],
        irr=None if irr is None else round(irr, 2), npv=round(m["npv"], 2), lcoe=round(m["lcos"], 4),
        payback_years=round(min(m["payback"], 99.0), 1), capacity_factor=None,
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
                "electricity_price": float(m["price_spread"]) / 1000,  # spread per kWh in the report maths
                "opex_annual": float(m["annual_opex"]),
                "currency": body.currency,
                "model_type": "storage_arbitrage",
                "assumption_provenance": provenance,
                "defaulted_assumptions": [f for f in STORAGE_DEFAULTED if provenance[f] != "user_input"],
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
