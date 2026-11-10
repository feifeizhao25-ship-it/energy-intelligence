"""电力二氧化碳减排量的单位换算。

全国因子取生态环境部、国家统计局公告 2025 年第 47 号表 1：
2023 年全国电力平均二氧化碳排放因子 0.5306 kgCO2/kWh。
已知且已收录的省使用同一公告附件表 3（与 carbon_asset.PROVINCIAL_GRID_FACTORS_2023 同一张表）。
https://www.mee.gov.cn/xxgk2018/xxgk/xxgk01/202512/t20251231_1139517.html
1 万吨 = 10^7 千克。千克除以 10^6 会把万吨放大 10 倍。
"""
from __future__ import annotations

import importlib.util
from pathlib import Path

NATIONAL_FACTOR_KG_PER_KWH = 0.5306
FACTOR_YEAR = 2023
FACTOR_SOURCE = "生态环境部、国家统计局公告2025年第47号"
FACTOR_URL = "https://www.mee.gov.cn/xxgk2018/xxgk/xxgk01/202512/t20251231_1139517.html"
KG_PER_WAN_TON = 10_000_000

_CARBON = None


def _carbon_module():
    """Load the existing provincial table. Do not copy its numbers into this file."""
    global _CARBON
    if _CARBON is None:
        path = Path(__file__).resolve().parents[3] / "services/monetization-service/app/skills/carbon_asset.py"
        spec = importlib.util.spec_from_file_location("carbon_asset_factors", path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        _CARBON = module
    return _CARBON


def resolve_grid_factor(province: str | None = None) -> tuple[float, str]:
    """Return (kgCO2/kWh, sentence). Listed provinces use table 3; otherwise national table 1."""
    module = _carbon_module()
    name = module.normalize_province(province) if province else None
    listed = module.PROVINCIAL_GRID_FACTORS_2023.get(name) if name else None
    if listed is not None:
        sentence = (
            f"按{FACTOR_YEAR}年{FACTOR_SOURCE}附件表3"
            f"{name}省级电力平均二氧化碳排放因子 {listed} kg/kWh 核算"
        )
        return float(listed), sentence
    if name:
        sentence = (
            f"按{FACTOR_YEAR}年{FACTOR_SOURCE}全国电力平均二氧化碳排放因子"
            f" {NATIONAL_FACTOR_KG_PER_KWH} kg/kWh 核算（公告未收录{name}省级因子）"
        )
    else:
        sentence = (
            f"按{FACTOR_YEAR}年{FACTOR_SOURCE}全国电力平均二氧化碳排放因子"
            f" {NATIONAL_FACTOR_KG_PER_KWH} kg/kWh 核算"
        )
    return NATIONAL_FACTOR_KG_PER_KWH, sentence


def avoided_kg(
    generation_kwh: float,
    factor_kg_per_kwh: float | None = None,
    *,
    province: str | None = None,
) -> float:
    if factor_kg_per_kwh is None:
        factor_kg_per_kwh = resolve_grid_factor(province)[0]
    return float(generation_kwh) * float(factor_kg_per_kwh)


def kg_to_wan_ton(kg: float) -> float:
    return float(kg) / KG_PER_WAN_TON


def avoided_wan_ton(
    generation_kwh: float,
    factor_kg_per_kwh: float | None = None,
    *,
    province: str | None = None,
) -> float:
    return kg_to_wan_ton(avoided_kg(generation_kwh, factor_kg_per_kwh, province=province))


def factor_sentence(province: str | None = None) -> str:
    return resolve_grid_factor(province)[1]
