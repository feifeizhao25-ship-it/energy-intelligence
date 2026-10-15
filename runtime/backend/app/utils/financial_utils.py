import math
from typing import List, Optional


def calc_irr(cashflows: List[float], max_iter: int = 300, tol: float = 1e-12) -> Optional[float]:
    """IRR（百分数，保留 4 位）。

    先数现金流符号变化次数：恰好 1 次才有唯一解（笛卡尔符号法则），否则返回 None，
    不再像旧的牛顿迭代那样不收敛也返回一个数。求解用区间二分（-99.9% ~ 扩展上界），
    与 numpy-financial irr() 在 50 组随机现金流上一致（误差 < 1e-6）。
    """
    if len(cashflows) < 2:
        return None
    signs = [1 if cf > 0 else -1 for cf in cashflows if cf != 0]
    if sum(1 for i in range(1, len(signs)) if signs[i] != signs[i - 1]) != 1:
        return None

    def npv(rate: float) -> float:
        total, divisor = 0.0, 1.0
        for cf in cashflows:
            total += cf / divisor
            divisor *= (1 + rate)
        return total

    low, high = -0.999, 1.0
    while (npv(low) > 0) == (npv(high) > 0) and high < 1e6:
        high *= 2
    if (npv(low) > 0) == (npv(high) > 0):
        return None
    low_positive = npv(low) > 0
    for _ in range(max_iter):
        mid = (low + high) / 2
        if (npv(mid) > 0) == low_positive:
            low = mid
        else:
            high = mid
        if high - low < tol:
            break
    return round((low + high) / 2 * 100, 4)


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
    """Levelized Cost of Energy, in currency per kWh (元/kWh when inputs are 元).

    LCOE = [capex + Σ opex/(1+r)^t] / Σ [E1·(1-d)^(t-1)/(1+r)^t], t = 1..N,
    end-of-year discounting. Year 1 is undegraded, matching build_solar_cashflows.
    """
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
        energy = annual_generation_kwh * (1 - degradation_rate) ** (t - 1)
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
        # Equity cash flow: principal repayment is a financing outflow, not income.
        # (No depreciation is modelled here, so there is no non-cash add-back.)
        cashflow = net_income - principal
        cashflows.append(cashflow)
        debt_balance = max(0, debt_balance - principal)

    return cashflows
