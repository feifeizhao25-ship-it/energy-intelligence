import math
from typing import List, Optional


def solve_irr_rate(cashflows: List[float], max_iter: int = 200, tol: float = 1e-12) -> Optional[float]:
    """与前端 project-finance.solveIrr 相同的二分法，返回小数利率。无唯一解返回 None。"""
    if len(cashflows) < 2:
        return None
    if any(cf != cf or cf in (float("inf"), float("-inf")) for cf in cashflows):
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
    return (low + high) / 2


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


def tax_assumptions(vat: str | None = None, income_tax: str | None = None) -> dict:
    """税费默认未计。方法卡同时列出简化度电成本与含税口径的差别。"""
    counted = bool(vat or income_tax)
    return {
        "增值税": vat or "未计",
        "所得税优惠": income_tax or "未计",
        "LCOE口径": "NREL 简化 LCOE（投资与运维折现，除以折现发电量）",
        "含税LCOE": "与简化口径的差额需把税额单独列入分子" if counted else "未计",
    }


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


# IRS Publication 946, 5-year MACRS, half-year convention. Six deduction years.
_MACRS_5YR = (0.2000, 0.3200, 0.1920, 0.1152, 0.1152, 0.0576)


def depreciation_for_year(
    capex: float,
    year: int,
    method: str,
    years: int,
    residual_rate: float,
    itc_rate: float,
    itc_basis_reduction: float,
) -> float:
    """Non-cash depreciation for one operating year. method 'none' returns 0 (legacy cashflows)."""
    if method in ("none", "", None) or year < 1:
        return 0.0
    basis = capex * (1.0 - max(0.0, itc_basis_reduction) * max(0.0, itc_rate))
    if method == "macrs_5":
        if year <= len(_MACRS_5YR):
            return basis * _MACRS_5YR[year - 1]
        return 0.0
    life = max(1, int(years))
    if year > life:
        return 0.0
    return basis * (1.0 - residual_rate) / life


def first_payback_year(cashflows: List[float]) -> Optional[float]:
    """First year index whose cumulative cash flow is positive. None if it never recovers."""
    total = 0.0
    for index, cashflow in enumerate(cashflows):
        total += cashflow
        if index > 0 and total > 0:
            return float(index)
    return None


def _solar_projection(
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
    depreciation_method: str = "none",
    depreciation_years: int = 20,
    residual_rate: float = 0.05,
    itc_basis_reduction: float = 0.0,
    ptc_per_mwh: float = 0.0,
) -> tuple:
    """Equity cashflows plus each year's debt-service coverage. No debt → coverage is empty.

    Depreciation is non-cash: it reduces taxable income and is not subtracted again from cash.
    The default method is 'none', so callers that do not opt in keep the previous cashflows.
    """
    capex = capacity_mw * 1_000_000 * capex_per_w  # currency units
    equity = capex * (1 - debt_ratio)
    debt = capex * debt_ratio
    annual_gen = capacity_mw * 1000 * 8760 * capacity_factor  # kWh/yr

    cashflows = [-equity]  # year 0: equity investment
    coverages: List[float] = []
    debt_balance = debt
    for yr in range(1, project_life + 1):
        generation = annual_gen * (1 - degradation_rate) ** (yr - 1)
        revenue = generation * electricity_price / 1000
        opex = capacity_mw * 1000 * opex_per_kw_yr
        interest = debt_balance * interest_rate
        principal = debt / project_life if project_life else 0.0
        dep = depreciation_for_year(
            capex, yr, depreciation_method, depreciation_years, residual_rate, itc_rate, itc_basis_reduction,
        )
        ptc_cash = (generation / 1000.0) * ptc_per_mwh
        ebitda = revenue - opex
        taxable = ebitda - interest - dep
        itc_benefit = capex * itc_rate if yr == 1 else 0
        tax = max(0.0, taxable * tax_rate) - itc_benefit - ptc_cash
        # Add depreciation back: cash = EBITDA − interest − tax − principal.
        cashflow = ebitda - interest - tax - principal
        cashflows.append(cashflow)
        service = interest + principal
        if service > 0:
            coverages.append((ebitda - tax) / service)
        debt_balance = max(0, debt_balance - principal)

    return cashflows, coverages


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
    depreciation_method: str = "none",
    depreciation_years: int = 20,
    residual_rate: float = 0.05,
    itc_basis_reduction: float = 0.0,
    ptc_per_mwh: float = 0.0,
) -> List[float]:
    """Build annual equity cashflows for a generation project (currency of the inputs)."""
    cashflows, _coverages = _solar_projection(
        capacity_mw, capex_per_w, opex_per_kw_yr, electricity_price, itc_rate,
        capacity_factor, degradation_rate, debt_ratio, interest_rate, tax_rate, project_life,
        depreciation_method=depreciation_method, depreciation_years=depreciation_years,
        residual_rate=residual_rate, itc_basis_reduction=itc_basis_reduction, ptc_per_mwh=ptc_per_mwh,
    )
    return cashflows


def min_solar_dscr(**kwargs) -> Optional[float]:
    """最低偿债覆盖倍数。没有借款时没有这一指标，返回 None，不用固定数代替。"""
    _cashflows, coverages = _solar_projection(**kwargs)
    if not coverages:
        return None
    return round(min(coverages), 4)


def build_wind_cashflows(
    capacity_mw: float,
    capex_per_kw: float,
    opex_per_kw_yr: float,
    electricity_price: float,
    wind_capacity_factor: float,
    debt_ratio: float,
    interest_rate: float,
    tax_rate: float,
    project_life: int,
    degradation_rate: float = 0.0,
    depreciation_method: str = "none",
    depreciation_years: int = 20,
    residual_rate: float = 0.05,
    ptc_per_mwh: float = 0.0,
) -> List[float]:
    """Wind equity cashflows. Capex is currency per kW; loan principal and interest are outflows."""
    return build_solar_cashflows(
        capacity_mw=capacity_mw,
        capex_per_w=capex_per_kw / 1000,
        opex_per_kw_yr=opex_per_kw_yr,
        electricity_price=electricity_price,
        itc_rate=0,
        capacity_factor=wind_capacity_factor,
        degradation_rate=degradation_rate,
        debt_ratio=debt_ratio,
        interest_rate=interest_rate,
        tax_rate=tax_rate,
        project_life=project_life,
        depreciation_method=depreciation_method,
        depreciation_years=depreciation_years,
        residual_rate=residual_rate,
        itc_basis_reduction=0.0,
        ptc_per_mwh=ptc_per_mwh,
    )


def resolve_depreciation(
    currency: str,
    itc_rate: float,
    method: Optional[str],
    years: int,
    residual_rate: float,
    itc_basis_reduction: Optional[float],
) -> dict:
    """CNY defaults to straight-line. Other currencies default to 5-year MACRS and a 50% ITC basis reduction."""
    cny = (currency or "").upper() == "CNY"
    chosen = method or ("straight_line" if cny else "macrs_5")
    basis_defaulted = itc_basis_reduction is None
    if itc_basis_reduction is None:
        itc_basis_reduction = 0.0 if cny or itc_rate <= 0 or chosen == "none" else 0.5
    return {
        "depreciation_method": chosen,
        "depreciation_years": years,
        "residual_rate": residual_rate,
        "itc_basis_reduction": itc_basis_reduction,
        "depreciation_defaulted": method is None,
        "basis_reduction_defaulted": basis_defaulted,
    }


def evaluate_power_project(
    *,
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
    currency: str,
    discount_rate: float,
    depreciation_method: Optional[str],
    depreciation_years: int,
    residual_rate: float,
    itc_basis_reduction: Optional[float],
    ptc_per_mwh: float,
    en: bool,
    kind: str,
    discount_rate_defaulted: bool = False,
) -> dict:
    """One engine for /finance/solar, /finance/wind, saved models and project reports.

    irr is the unlevered after-tax project IRR. equity_irr is the equity IRR.
    They differ once there is debt. NPV discounts the unlevered after-tax cash flows.
    """
    policy = resolve_depreciation(currency, itc_rate, depreciation_method, depreciation_years, residual_rate, itc_basis_reduction)
    common = dict(
        capacity_mw=capacity_mw, capex_per_w=capex_per_w, opex_per_kw_yr=opex_per_kw_yr,
        electricity_price=electricity_price, itc_rate=itc_rate, capacity_factor=capacity_factor,
        degradation_rate=degradation_rate, interest_rate=interest_rate, tax_rate=tax_rate,
        project_life=project_life, depreciation_method=policy["depreciation_method"],
        depreciation_years=policy["depreciation_years"], residual_rate=policy["residual_rate"],
        itc_basis_reduction=policy["itc_basis_reduction"], ptc_per_mwh=ptc_per_mwh,
    )
    equity = build_solar_cashflows(**common, debt_ratio=debt_ratio)
    pretax = build_solar_cashflows(**{**common, "debt_ratio": 0, "tax_rate": 0, "itc_rate": 0, "ptc_per_mwh": 0})
    aftertax = build_solar_cashflows(**common, debt_ratio=0)
    equity_irr = calc_irr(equity)
    pretax_irr = calc_irr(pretax)
    aftertax_irr = calc_irr(aftertax)
    capex_total = capacity_mw * 1_000_000 * capex_per_w
    opex_total = capacity_mw * 1000 * opex_per_kw_yr
    annual_gen_kwh = capacity_mw * 1000 * 8760 * capacity_factor
    lcoe = calc_lcoe(
        capex_total, opex_total, annual_gen_kwh,
        discount_rate=discount_rate, degradation_rate=degradation_rate, project_life=project_life,
    )
    dscr = min_solar_dscr(**common, debt_ratio=debt_ratio)
    payback = first_payback_year(equity)
    project_payback = first_payback_year(pretax)
    assumptions = _assumption_lines(
        en=en, kind=kind, currency=currency, discount_rate=discount_rate,
        discount_defaulted=discount_rate_defaulted, tax_rate=tax_rate, debt_ratio=debt_ratio,
        interest_rate=interest_rate, itc_rate=itc_rate, ptc_per_mwh=ptc_per_mwh, policy=policy,
    )
    return {
        "irr": aftertax_irr,
        "project_irr_pretax": pretax_irr,
        "project_irr_aftertax": aftertax_irr,
        "equity_irr": equity_irr,
        "npv": calc_npv(discount_rate, aftertax),
        "equity_npv": calc_npv(discount_rate, equity),
        "lcoe": lcoe,
        "payback_years": payback,
        "project_payback_years": project_payback,
        "payback_basis": "equity" if en else "资本金回收期",
        "dscr_min": dscr,
        "cashflows": equity[1:],
        "equity_cashflows_with_investment": equity,
        "discount_rate": discount_rate,
        "assumptions": assumptions,
        "basis": {
            "discount_rate": discount_rate,
            "tax_rate": tax_rate,
            "debt_ratio": debt_ratio,
            "interest_rate": interest_rate,
            "depreciation_method": policy["depreciation_method"],
            "depreciation_years": policy["depreciation_years"],
            "residual_rate": policy["residual_rate"],
            "itc_rate": itc_rate,
            "itc_basis_reduction": policy["itc_basis_reduction"],
            "ptc_per_mwh": ptc_per_mwh,
            "irr_definition": "project_aftertax",
            "equity_irr_definition": "equity_aftertax",
            "npv_cashflows": "project_aftertax",
            "lcoe": "discounted_cost_over_discounted_energy",
            "currency": currency,
        },
        "sensitivity": {
            "capex_+10pct_irr": calc_irr(build_solar_cashflows(
                **{**common, "capex_per_w": capex_per_w * 1.1}, debt_ratio=0,
            )),
            "price_-10pct_irr": calc_irr(build_solar_cashflows(
                **{**common, "electricity_price": electricity_price * 0.9}, debt_ratio=0,
            )),
        },
    }


def _assumption_lines(*, en: bool, kind: str, currency: str, discount_rate: float, discount_defaulted: bool,
                      tax_rate: float, debt_ratio: float, interest_rate: float, itc_rate: float,
                      ptc_per_mwh: float, policy: dict) -> List[str]:
    method = policy["depreciation_method"]
    if en:
        dep = (
            "Depreciation: 5-year MACRS, half-year convention (IRS Publication 946 rates). "
            f"Depreciable basis is reduced by {policy['itc_basis_reduction']:.0%} of the investment tax credit."
            if method == "macrs_5" else
            f"Depreciation: straight line over {policy['depreciation_years']} years, residual {policy['residual_rate']:.0%}."
            if method == "straight_line" else
            "Depreciation: not applied."
        )
        lines = [
            f"Discount rate: {discount_rate:.2%}" + (" (default; send discount_rate to override)." if discount_defaulted else "."),
            f"Income tax rate: {tax_rate:.2%}. Debt ratio: {debt_ratio:.0%}. Interest rate: {interest_rate:.2%}.",
            dep,
            "irr is the unlevered after-tax project IRR. equity_irr is the after-tax equity IRR. project_irr_pretax ignores tax and financing.",
            "NPV discounts unlevered after-tax cash flows at the discount rate above. cashflows are the equity series, excluding year 0.",
            "payback_years is the equity payback. null means the project does not pay back within its life. project_payback_years is the unlevered pre-tax payback.",
            "LCOE = present value of capital and operating costs / present value of generation. Both sides are discounted.",
            "Value-added tax and tax holidays are not included.",
        ]
        if itc_rate > 0:
            lines.append(f"Investment tax credit: {itc_rate:.0%} of capital cost, taken as a year-1 cash credit.")
        if kind == "wind":
            lines.append(
                f"Production tax credit: {ptc_per_mwh:g} per MWh." if ptc_per_mwh > 0
                else "Production tax credit (PTC): not included. Send ptc_per_mwh to apply one."
            )
        lines.append(f"Currency: {currency}.")
        return lines
    dep = (
        f"折旧：直线法 {policy['depreciation_years']} 年，残值率 {policy['residual_rate']:.0%}"
        + ("（请求未传方法时的默认值，可改）。" if policy["depreciation_defaulted"] else "。")
        if method == "straight_line" else
        "折旧：5 年 MACRS（美国 IRS Publication 946 半年惯例）。计税基数按投资税收抵免额的 "
        f"{policy['itc_basis_reduction']:.0%} 调减。"
        if method == "macrs_5" else
        "折旧：未计。"
    )
    lines = [
        f"折现率：{discount_rate:.2%}" + ("（请求未传，按默认值；可在请求里修改）。" if discount_defaulted else "。"),
        f"所得税税率：{tax_rate:.2%}。贷款比例：{debt_ratio:.0%}。贷款利率：{interest_rate:.2%}。",
        dep,
        "irr 是全投资税后内部收益率；equity_irr 是资本金税后内部收益率；project_irr_pretax 是全投资税前内部收益率。",
        "净现值按全投资税后现金流、上面的折现率计算。cashflows 是资本金现金流，不含第 0 年投入。",
        "payback_years 是资本金回收期，寿命期内收不回时为空。project_payback_years 是全投资税前回收期。",
        "度电成本 = 投资与运维的现值 / 发电量现值，分子和分母都折现。",
        "增值税、三免三减半、设备更换：未计。",
        f"币种：{currency}。",
    ]
    if kind == "wind" and ptc_per_mwh <= 0:
        lines.append("生产税抵免：未计。")
    return lines
