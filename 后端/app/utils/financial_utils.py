import math
from typing import List


def calc_irr(cashflows: List[float], max_iter: int = 1000, tol: float = 1e-7) -> float:
    """Newton-Raphson IRR calculation with overflow protection."""
    if len(cashflows) < 2:
        return 0.0

    rate = 0.1  # initial guess
    for _ in range(max_iter):
        # Compute NPV using iterative division (avoids power overflow)
        npv = 0.0
        dnpv = 0.0
        divisor = 1.0
        for t, cf in enumerate(cashflows):
            npv += cf / divisor
            if t > 0:
                dnpv += -t * cf / (divisor * (1 + rate))
            divisor *= (1 + rate)

        if abs(dnpv) < 1e-15:
            break
        new_rate = rate - npv / dnpv
        if abs(new_rate - rate) < tol:
            return round(new_rate * 100, 4)
        rate = new_rate
    return round(rate * 100, 4)


def calc_npv(rate: float, cashflows: List[float]) -> float:
    """Net Present Value — iterative to avoid overflow."""
    npv = 0.0
    divisor = 1.0
    for cf in cashflows:
        npv += cf / divisor
        divisor *= (1 + rate)
    return round(npv, 2)


def calc_lcoe(
    capex: float,
    opex_annual: float,
    annual_generation_kwh: float,
    discount_rate: float = 0.08,
    project_life: int = 25,
    degradation_rate: float = 0.005,
) -> float:
    """Levelized Cost of Energy ($/kWh) — scaled to avoid overflow."""
    # Work in millions to avoid overflow
    scale = 1_000_000.0  # work in USD millions
    capex_m = capex / scale
    opex_m = opex_annual / scale

    pv_cost = capex_m
    pv_energy = 0.0
    divisor = 1.0
    for t in range(1, project_life + 1):
        divisor *= (1 + discount_rate)
        pv_cost += opex_m / divisor
        energy = annual_generation_kwh * (1 - degradation_rate) ** t
        pv_energy += energy / divisor

    return round((pv_cost * scale) / pv_energy, 4) if pv_energy > 0 else 0.0


def calc_optimal_cleaning_interval(
    cleaning_cost_usd: float,
    daily_revenue_usd: float,
    soiling_rate_pct_per_day: float,
) -> int:
    """Optimal cleaning interval (days)."""
    if daily_revenue_usd <= 0 or soiling_rate_pct_per_day <= 0:
        return 30
    days = math.sqrt(2 * cleaning_cost_usd / (daily_revenue_usd * soiling_rate_pct_per_day / 100))
    return max(1, round(days))


def build_solar_cashflows(
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
) -> List[float]:
    """Build annual equity cashflows for a solar project (USD)."""
    capex = capacity_mw * 1_000_000 * capex_per_w  # USD
    equity = capex * (1 - debt_ratio)
    debt = capex * debt_ratio
    annual_gen = capacity_mw * 1000 * 8760 * capacity_factor  # kWh/yr

    cashflows = [-equity]  # year 0: equity investment
    debt_balance = debt
    for yr in range(1, project_life + 1):
        generation = annual_gen * (1 - degradation_rate) ** (yr - 1)
        revenue = generation * electricity_price / 1000  # USD
        opex = capacity_mw * 1000 * opex_per_kw_yr  # USD
        interest = debt_balance * interest_rate
        principal = debt / project_life
        ebitda = revenue - opex
        ebt = ebt_d = ebitda - interest
        itc_benefit = capex * itc_rate if yr == 1 else 0
        tax = max(0, ebt_d * tax_rate) - itc_benefit
        net_income = ebt_d - tax
        cashflow = net_income + principal  # add back principal repayment
        cashflows.append(cashflow)
        debt_balance = max(0, debt_balance - principal)

    return cashflows
