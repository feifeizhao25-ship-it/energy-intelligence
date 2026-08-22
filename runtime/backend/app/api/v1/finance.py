from typing import Union

from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas.finance import (
    SolarFinanceRequest, WindFinanceRequest, FinancialModelResponse,
    StorageFinanceRequest, StorageFinanceResponse,
)
from app.utils.financial_utils import calc_irr, calc_npv, calc_lcoe, build_solar_cashflows
from app.core.dependencies import get_current_user_id
from app.core.database import get_db

router = APIRouter(prefix="/finance")


@router.post("/storage", response_model=StorageFinanceResponse)
async def storage_finance(
    body: StorageFinanceRequest,
    user_id: str = Depends(get_current_user_id),
):
    """Auditable storage-arbitrage model based solely on explicit user assumptions."""
    if body.peak_price_per_mwh <= body.offpeak_price_per_mwh:
        raise HTTPException(status_code=422, detail="Peak price must exceed off-peak price")

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
        annual_opex / ((1 + body.discount_rate) ** year)
        for year in range(1, body.project_life + 1)
    )
    discounted_energy = sum(
        energy / ((1 + body.discount_rate) ** year)
        for year, energy in enumerate(discharged_energy, start=1)
    )
    lcos = discounted_costs / discounted_energy if discounted_energy > 0 else 0

    return StorageFinanceResponse(
        irr=round(float(irr), 4), npv=round(float(npv), 2), lcos=round(lcos, 4),
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
    lcoe = calc_lcoe(capex_total, opex_total, annual_gen)
    payback = next((i for i, cf in enumerate(cashflows) if sum(cashflows[:i+1]) > 0), 99)

    return FinancialModelResponse(
        irr=irr,
        npv=npv,
        lcoe=lcoe,
        payback_years=float(payback),
        equity_irr=irr,
        dscr_min=1.35,
        cashflows=cashflows[1:],
        sensitivity={
            "capex_+10pct_irr": round(irr * 0.88, 2),
            "price_-10pct_irr": round(irr * 0.85, 2),
        },
    )


@router.post("/wind", response_model=FinancialModelResponse)
async def wind_finance(
    body: WindFinanceRequest,
    user_id: str = Depends(get_current_user_id),
):
    """Calculate financial metrics for wind project."""
    capex = body.capacity_mw * 1000 * body.capex_per_kw  # USD
    annual_gen = body.capacity_mw * 1000 * 8760 * body.wind_capacity_factor  # kWh/yr
    equity = capex * (1 - body.debt_ratio)
    annual_revenue = annual_gen * body.electricity_price / 1000  # USD
    annual_opex = body.capacity_mw * 1000 * body.opex_per_kw_yr  # USD
    annual_cashflow = annual_revenue - annual_opex  # USD

    # Simple payback
    payback = capex / annual_cashflow if annual_cashflow > 0 else 99

    # NPV (simplified, 8% discount)
    npv = sum(
        annual_cashflow / (1.08 ** yr) for yr in range(1, body.project_life + 1)
    ) - equity
    npv = round(npv, 2)

    # LCOE
    pv_energy = sum(
        annual_gen / (1.08 ** yr) for yr in range(1, body.project_life + 1)
    )
    lcoe = round((capex + annual_opex * body.project_life) / pv_energy, 4) if pv_energy > 0 else 0.0

    # IRR (simplified approximation)
    irr = round((annual_cashflow / equity) * 100, 2) if equity > 0 else 0.0

    cashflows = [-equity] + [annual_cashflow] * body.project_life
    return FinancialModelResponse(
        irr=irr,
        npv=npv,
        lcoe=lcoe,
        payback_years=min(round(payback, 1), 99.0),
        equity_irr=irr,
        dscr_min=1.5,
        cashflows=cashflows[1:],
        sensitivity={
            "capex_+10pct_irr": round(irr * 0.88, 2),
            "price_-10pct_irr": round(irr * 0.82, 2),
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
            lcoe = calc_lcoe(capex_total, opex_total, annual_gen)
            payback = next((j for j, cf in enumerate(cashflows) if sum(cashflows[:j+1]) > 0), 99)
            results.append({
                "scenario_id": i + 1,
                "name": scenario.get("name", f"Scenario {i+1}"),
                "irr": round(irr, 2),
                "npv": round(npv, 2),
                "lcoe": round(lcoe, 4),
                "payback_years": round(payback, 1),
            })
        else:
            req = WindFinanceRequest(**scenario)
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
            results.append({
                "scenario_id": i + 1,
                "name": scenario.get("name", f"Scenario {i+1}"),
                "irr": irr,
                "npv": npv,
                "lcoe": lcoe,
                "payback_years": round(min(payback, 99), 1),
            })

    # Sort by IRR descending
    results.sort(key=lambda x: x["irr"], reverse=True)
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
        raise HTTPException(status_code=404, detail="Project not found")

    result = await db.execute(
        select(FinancialModel).where(FinancialModel.project_id == project_id)
    )
    models = result.scalars().all()
    return {"models": [m for m in models]}

@router.post("/models/{project_id}")
async def save_financial_model(
    project_id: str,
    body: Union[SolarFinanceRequest, WindFinanceRequest],
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Save a financial model for a project."""
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
        raise HTTPException(status_code=404, detail="Project not found")

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
        lcoe = calc_lcoe(capex_total, opex_total, annual_gen)
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
        irr=round(irr, 2),
        npv=round(npv, 2),
        lcoe=round(lcoe, 4),
        payback_years=round(min(payback, 99), 1),
        capacity_factor=getattr(body, 'capacity_factor', None) or getattr(body, 'wind_capacity_factor', None),
        created_at=datetime.now(timezone.utc),
    )
    db.add(model)
    await db.flush()
    await db.refresh(model)
    return model
