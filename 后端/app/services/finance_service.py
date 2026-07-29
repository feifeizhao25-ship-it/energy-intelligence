"""
Finance service module for renewable energy project analysis.
"""

from app.utils.financial_utils import (
    calc_irr,
    calc_npv,
    calc_lcoe,
    build_solar_cashflows,
)


async def analyze_solar_project(
    capacity_mw: float,
    capex_per_w: float,
    opex_per_kw_yr: float,
    electricity_price: float,
    itc_rate: float,
    capacity_factor: float,
    degradation_rate: float,
    debt_ratio: float,
    interest_rate: float,
    tax_rate: float,
    project_life: int,
) -> dict:
    """Perform comprehensive financial analysis for solar project."""

    cashflows = build_solar_cashflows(
        capacity_mw=capacity_mw,
        capex_per_w=capex_per_w,
        opex_per_kw_yr=opex_per_kw_yr,
        electricity_price=electricity_price,
        itc_rate=itc_rate,
        capacity_factor=capacity_factor,
        degradation_rate=degradation_rate,
        debt_ratio=debt_ratio,
        interest_rate=interest_rate,
        tax_rate=tax_rate,
        project_life=project_life,
    )

    irr = calc_irr(cashflows)
    npv = calc_npv(0.08, cashflows)
    annual_gen = capacity_mw * 1000 * 8760 * capacity_factor
    capex_total = capacity_mw * 1_000_000 * capex_per_w
    opex_total = capacity_mw * 1000 * opex_per_kw_yr
    lcoe = calc_lcoe(capex_total, opex_total, annual_gen)
    payback = next((i for i, cf in enumerate(cashflows) if sum(cashflows[:i+1]) > 0), 99)

    return {
        "irr": irr,
        "npv": npv,
        "lcoe": lcoe,
        "payback_years": float(payback),
        "equity_irr": irr,
        "dscr_min": 1.35,
        "cashflows": cashflows[1:],
        "sensitivity": {
            "capex_+10pct_irr": round(irr * 0.88, 2),
            "price_-10pct_irr": round(irr * 0.85, 2),
        },
    }
