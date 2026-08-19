"""CA-001 碳资产测算技能（恢复重建版）。

真实计算逻辑（纯参数化计算，无外部依赖）：
1. 减排量 = 年发电量(MWh) × 全国电力平均排放因子(tCO2/MWh)，
   默认因子 0.5366 出自生态环境部、国家统计局 2024 年 12 月联合发布的
   《2022 年电力二氧化碳排放因子公告》，可用 grid_emission_factor 覆盖；
2. CCER 潜在收益 = 减排量 × 价格区间（给区间不给单点）；
   价格为市场假设——生产环境必须显式提供价格区间（fail-closed），
   开发环境使用内置区间并标注 estimated；
3. 欧盟 CBAM 碳成本（仅 market=global 且提供 embedded_emissions_tco2 时）：
   成本 = 嵌入排放 × (1 - 免费配额比例) × EU ETS 价格，
   ETS 价格同样在生产环境必须显式提供。

market=cn 输出中文键名说明，market=global 输出英文键名。
"""

from __future__ import annotations

import os
from typing import Any, Dict, List, Optional

# 生态环境部、国家统计局《2022年电力二氧化碳排放因子公告》（2024-12 发布）：
# 全国电力平均排放因子 0.5366 tCO2/MWh
DEFAULT_GRID_FACTOR_TCO2_PER_MWH = 0.5366
GRID_FACTOR_SOURCE_CN = (
    "生态环境部、国家统计局《2022年电力二氧化碳排放因子公告》（2024年12月发布），"
    "全国电力平均排放因子 0.5366 tCO2/MWh"
)
GRID_FACTOR_SOURCE_EN = (
    "MEE & NBS of China, 2022 national average grid CO2 emission factor "
    "0.5366 tCO2/MWh (published Dec 2024)"
)

# 开发环境内置价格假设（生产环境禁止，必须显式传入）
DEV_CCER_PRICE_BAND_CNY = (60.0, 100.0)  # 全国温室气体自愿减排交易市场常见成交区间
DEV_ETS_PRICE_EUR = 85.0  # EU ETS 2024-2025 年常见现货区间中值附近


def _is_production() -> bool:
    return (
        os.getenv("ENVIRONMENT", "").lower() == "production"
        or os.getenv("APP_ENV", "").lower() == "production"
    )


def _require_explicit_prices(params: Dict[str, Any], need_cbam: bool) -> None:
    """生产环境 fail-closed：价格假设不得用内置合成值冒充真实市场数据。"""
    if params.get("ccer_price_low") is None or params.get("ccer_price_high") is None:
        raise RuntimeError(
            "CA-001 生产环境必须显式提供 ccer_price_low/ccer_price_high，"
            "拒绝使用内置价格假设冒充真实市场结果"
        )
    if need_cbam and params.get("eu_ets_price_eur") is None:
        raise RuntimeError(
            "CA-001 生产环境计算 CBAM 必须显式提供 eu_ets_price_eur，"
            "拒绝使用内置价格假设冒充真实市场结果"
        )


def compute_reduction_tco2(annual_generation_mwh: float, grid_factor: float) -> float:
    """纯函数：电网排放因子法减排量 = 年发电量 × 排放因子。"""
    return annual_generation_mwh * grid_factor


def compute_ccer_revenue_range(
    reduction_tco2: float, price_low: float, price_high: float
) -> List[float]:
    """CCER 潜在收益区间（CNY），给区间不给单点。"""
    return [reduction_tco2 * price_low, reduction_tco2 * price_high]


def compute_cbam_cost_eur(
    embedded_emissions_tco2: float,
    ets_price_eur: float,
    free_allocation_rate: float,
) -> float:
    """CBAM 碳成本 = 嵌入排放 × (1 - 免费配额比例) × ETS 价格。"""
    return embedded_emissions_tco2 * (1.0 - free_allocation_rate) * ets_price_eur


class CarbonAssetSkill:
    """CA-001 碳资产测算。"""

    skill_id = "CA-001"
    name = "碳资产测算"
    description = (
        "按全国电网排放因子法测算新能源电站年减排量（tCO2），并估算 "
        "CCER 潜在收益区间（CNY）与欧盟 CBAM 碳成本（EUR，仅 global 市场）；"
        "价格类假设在生产环境必须显式传入，否则 fail-closed。"
    )
    category = "CA"
    references = [
        "生态环境部、国家统计局《2022年电力二氧化碳排放因子公告》（2024年12月）0.5366 tCO2/MWh",
        "《温室气体自愿减排交易管理办法（试行）》（生态环境部 2023）CCER 机制",
        "EU Regulation 2023/956 (CBAM)：嵌入排放 × ETS 价格，扣除免费配额",
        "生态环境部《企业温室气体排放核算方法与报告指南 发电设施》排放因子法",
    ]

    def validate(self, params: Dict[str, Any]) -> bool:
        generation = params.get("annual_generation_mwh")
        return generation is not None and float(generation) > 0

    async def execute(self, params: Dict[str, Any]) -> Dict[str, Any]:
        generation_raw = params.get("annual_generation_mwh")
        if generation_raw is None:
            raise ValueError("CA-001 需要 annual_generation_mwh 参数")
        annual_generation_mwh = float(generation_raw)
        if annual_generation_mwh <= 0:
            raise ValueError("CA-001 年发电量必须为正数")

        market = params.get("market", "cn")
        grid_factor = float(
            params.get("grid_emission_factor", DEFAULT_GRID_FACTOR_TCO2_PER_MWH)
        )
        factor_source = (
            params.get("grid_emission_factor_source")
            or (GRID_FACTOR_SOURCE_EN if market == "global" else GRID_FACTOR_SOURCE_CN)
        )

        embedded_raw = params.get("embedded_emissions_tco2")
        need_cbam = market == "global" and embedded_raw is not None
        estimated = False

        if _is_production():
            _require_explicit_prices(params, need_cbam)

        ccer_low = params.get("ccer_price_low")
        ccer_high = params.get("ccer_price_high")
        if ccer_low is None or ccer_high is None:
            ccer_low, ccer_high = DEV_CCER_PRICE_BAND_CNY
            estimated = True
        ccer_low = float(ccer_low)
        ccer_high = float(ccer_high)
        if ccer_low <= 0 or ccer_high < ccer_low:
            raise ValueError("CA-001 CCER 价格区间无效")

        ets_price = params.get("eu_ets_price_eur")
        if need_cbam:
            if ets_price is None:
                ets_price = DEV_ETS_PRICE_EUR
                estimated = True
            ets_price = float(ets_price)

        reduction = compute_reduction_tco2(annual_generation_mwh, grid_factor)
        ccer_range = compute_ccer_revenue_range(reduction, ccer_low, ccer_high)

        emissions_raw = params.get("annual_emissions_tco2")
        offset_ratio: Optional[float] = None
        if emissions_raw is not None:
            annual_emissions = float(emissions_raw)
            if annual_emissions > 0:
                offset_ratio = reduction / annual_emissions

        common = {
            "skill_id": self.skill_id,
            "market": market,
            "engine": "grid_emission_factor_method",
            "estimated": estimated,
            "references": list(self.references),
        }

        if market == "global":
            result = {
                "emission_reduction_tco2": round(reduction, 3),
                "grid_emission_factor_tco2_per_mwh": grid_factor,
                "grid_emission_factor_source": factor_source,
                "ccer_potential_revenue_cny": {
                    "low": round(ccer_range[0], 2),
                    "high": round(ccer_range[1], 2),
                    "price_band_assumption_cny_per_t": [ccer_low, ccer_high],
                },
            }
            if offset_ratio is not None:
                result["offset_ratio"] = round(offset_ratio, 4)
            if need_cbam:
                free_alloc = float(params.get("cbam_free_allocation_rate", 0.0))
                cost = compute_cbam_cost_eur(
                    float(embedded_raw), ets_price, free_alloc
                )
                result["cbam_carbon_cost_eur"] = {
                    "cost_eur": round(cost, 2),
                    "embedded_emissions_tco2": float(embedded_raw),
                    "eu_ets_price_eur": ets_price,
                    "free_allocation_rate": free_alloc,
                }
            if estimated:
                result["warning"] = (
                    "Price band is a built-in assumption — provide explicit "
                    "market prices for production use"
                )
        else:
            result = {
                "减排量_tCO2": round(reduction, 3),
                "排放因子_tCO2每MWh": grid_factor,
                "排放因子出处": factor_source,
                "CCER潜在收益_CNY": {
                    "下限": round(ccer_range[0], 2),
                    "上限": round(ccer_range[1], 2),
                    "价格区间假设_CNY每吨": [ccer_low, ccer_high],
                },
            }
            if offset_ratio is not None:
                result["抵消比例"] = round(offset_ratio, 4)
            if estimated:
                result["warning"] = (
                    "价格区间为内置假设——生产环境请显式提供市场价格"
                )

        result.update(common)
        return result
