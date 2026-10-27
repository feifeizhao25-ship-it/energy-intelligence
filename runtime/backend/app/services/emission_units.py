"""电力二氧化碳减排量的单位换算。

全国因子取生态环境部、国家统计局公告 2025 年第 47 号表 1：
2023 年全国电力平均二氧化碳排放因子 0.5306 kgCO2/kWh。
https://www.mee.gov.cn/xxgk2018/xxgk/xxgk01/202512/t20251231_1139517.html
1 万吨 = 10^7 千克。千克除以 10^6 会把万吨放大 10 倍。
"""
from __future__ import annotations

NATIONAL_FACTOR_KG_PER_KWH = 0.5306
FACTOR_YEAR = 2023
FACTOR_SOURCE = "生态环境部、国家统计局公告2025年第47号"
FACTOR_URL = "https://www.mee.gov.cn/xxgk2018/xxgk/xxgk01/202512/t20251231_1139517.html"
KG_PER_WAN_TON = 10_000_000


def avoided_kg(generation_kwh: float, factor_kg_per_kwh: float = NATIONAL_FACTOR_KG_PER_KWH) -> float:
    return float(generation_kwh) * float(factor_kg_per_kwh)


def kg_to_wan_ton(kg: float) -> float:
    return float(kg) / KG_PER_WAN_TON


def avoided_wan_ton(generation_kwh: float, factor_kg_per_kwh: float = NATIONAL_FACTOR_KG_PER_KWH) -> float:
    return kg_to_wan_ton(avoided_kg(generation_kwh, factor_kg_per_kwh))


def factor_sentence() -> str:
    return (
        f"按{FACTOR_YEAR}年{FACTOR_SOURCE}全国电力平均二氧化碳排放因子"
        f" {NATIONAL_FACTOR_KG_PER_KWH} kg/kWh 核算"
    )
