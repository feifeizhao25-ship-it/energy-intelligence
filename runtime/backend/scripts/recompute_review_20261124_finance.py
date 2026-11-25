"""能3 / 能4 / 能5 / 智4 / 智5 的独立复算。不读数据库，不调用模型。

运行：python scripts/recompute_review_20261124_finance.py
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.schemas.finance import SolarFinanceRequest, StorageFinanceRequest
from app.api.v1.finance import storage_model
from app.utils.financial_utils import evaluate_power_project


def old_storage_revenue(capacity_mwh, cycles, efficiency, peak, offpeak) -> float:
    discharged = capacity_mwh * cycles * efficiency
    return discharged * (peak - offpeak)


def new_storage_revenue(capacity_mwh, cycles, efficiency, peak, offpeak) -> float:
    discharged = capacity_mwh * cycles * efficiency
    charged = discharged / efficiency
    return discharged * peak - charged * offpeak


def main() -> None:
    capacity, cycles, efficiency, peak, offpeak = 20, 300, 0.88, 800, 300
    old = old_storage_revenue(capacity, cycles, efficiency, peak, offpeak)
    new = new_storage_revenue(capacity, cycles, efficiency, peak, offpeak)
    correct = 5280 * 800 - 6000 * 300
    print("储能净收入")
    print(f"  输入: 容量 {capacity} MWh, 循环 {cycles}, 往返效率 {efficiency}, 峰价 {peak}, 谷价 {offpeak}")
    print(f"  旧结果（放电量 × 价差）: {old:,.0f}")
    print(f"  新结果（放电×峰价 − 充电×谷价）: {new:,.0f}")
    print(f"  正确值: {correct:,.0f}    依据: 充电量 = 放电量 / 往返效率 = 6000 MWh")
    assert new == correct

    body = StorageFinanceRequest(
        power_mw=10, capacity_mwh=capacity, cycles_per_year=cycles,
        peak_price_per_mwh=peak, offpeak_price_per_mwh=offpeak, capex_per_kwh=1200,
        roundtrip_efficiency=efficiency, currency="CNY", project_life=15,
    )
    model = storage_model(body)
    print(f"  引擎年净收入: {model['initial_discharged'] * peak - model['initial_charged'] * offpeak:,.0f}")
    print(f"  LCOS 不含充电: {model['lcos_excluding']:.4f}    含充电: {model['lcos_including']:.4f}")

    request = SolarFinanceRequest(
        capacity_mw=5, capex_per_w=3.2, opex_per_kw_yr=70, electricity_price=0.3844,
        capacity_factor=0.15, debt_ratio=0.7, interest_rate=0.045, tax_rate=0.25,
        project_life=25, currency="CNY", itc_rate=0, discount_rate=0.08,
    )
    metrics = evaluate_power_project(
        capacity_mw=request.capacity_mw, capex_per_w=request.capex_per_w,
        opex_per_kw_yr=request.opex_per_kw_yr, electricity_price=request.electricity_price,
        itc_rate=request.itc_rate, capacity_factor=request.capacity_factor,
        degradation_rate=request.degradation_rate, debt_ratio=request.debt_ratio,
        interest_rate=request.interest_rate, tax_rate=request.tax_rate,
        project_life=request.project_life, currency=request.currency,
        discount_rate=request.discount_rate, depreciation_method=request.depreciation_method,
        depreciation_years=request.depreciation_years, residual_rate=request.residual_rate,
        itc_basis_reduction=request.itc_basis_reduction, ptc_per_mwh=0, en=False, kind="solar",
    )
    print("光伏 5 MW、电价 0.3844 元/千瓦时、贷款 70%、利率 4.5%、所得税 25%、折现率 8%")
    print(f"  旧口径: irr 与 equity_irr 是同一个资本金收益率，不计折旧，折现率不出现在结果里")
    print(f"  新全投资税前 IRR: {metrics['project_irr_pretax']}")
    print(f"  新全投资税后 IRR: {metrics['project_irr_aftertax']}")
    print(f"  新资本金 IRR: {metrics['equity_irr']}")
    print(f"  新 NPV（全投资税后，8%）: {metrics['npv']}")
    print(f"  新 LCOE（成本现值/发电量现值）: {metrics['lcoe']}")
    print(f"  折旧: {metrics['basis']['depreciation_method']} {metrics['basis']['depreciation_years']} 年，残值 {metrics['basis']['residual_rate']}")
    print("  依据: 资本金现金流从权益出资起算并扣还本付息；全投资现金流从全部投资起算、不含贷款。税后扣除直线折旧的税盾。")
    assert metrics["irr"] != metrics["equity_irr"]


if __name__ == "__main__":
    main()
