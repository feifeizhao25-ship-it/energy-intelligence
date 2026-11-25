"""
Finance service module for renewable energy project analysis.
"""

from app.utils.financial_utils import evaluate_power_project


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

    metrics = evaluate_power_project(
        capacity_mw=capacity_mw, capex_per_w=capex_per_w, opex_per_kw_yr=opex_per_kw_yr,
        electricity_price=electricity_price, itc_rate=itc_rate, capacity_factor=capacity_factor,
        degradation_rate=degradation_rate, debt_ratio=debt_ratio, interest_rate=interest_rate,
        tax_rate=tax_rate, project_life=project_life, currency="USD", discount_rate=0.08,
        depreciation_method=None, depreciation_years=20, residual_rate=0.05, itc_basis_reduction=None,
        ptc_per_mwh=0.0, en=True, kind="solar", discount_rate_defaulted=True,
    )
    metrics.pop("equity_cashflows_with_investment", None)
    return metrics
