"""电力二氧化碳减排量的单位换算。

全国因子取生态环境部、国家统计局公告 2025 年第 47 号表 1：
2023 年全国电力平均二氧化碳排放因子 0.5306 kgCO2/kWh。
已知且已收录的省使用同一公告附件表 3（与 carbon_asset.PROVINCIAL_GRID_FACTORS_2023 同一张表）。
https://www.mee.gov.cn/xxgk2018/xxgk/xxgk01/202512/t20251231_1139517.html
1 万吨 = 10^7 千克。千克除以 10^6 会把万吨放大 10 倍。
"""
from __future__ import annotations

import importlib.util
import logging
import os
from pathlib import Path

logger = logging.getLogger(__name__)

NATIONAL_FACTOR_KG_PER_KWH = 0.5306
FACTOR_YEAR = 2023
FACTOR_SOURCE = "生态环境部、国家统计局公告2025年第47号"
FACTOR_URL = "https://www.mee.gov.cn/xxgk2018/xxgk/xxgk01/202512/t20251231_1139517.html"
KG_PER_WAN_TON = 10_000_000

_CARBON = None
_TABLE_REL = Path("monetization-service/app/skills/carbon_asset.py")


def _national_sentence() -> str:
    return (
        f"按{FACTOR_YEAR}年{FACTOR_SOURCE}全国电力平均二氧化碳排放因子"
        f" {NATIONAL_FACTOR_KG_PER_KWH} kg/kWh 核算"
    )


def _carbon_paths() -> list[Path]:
    """Repo layout is parents[3]/services; the backend image copies services to parents[2]/services."""
    here = Path(__file__).resolve()
    roots: list[Path] = []
    env = os.getenv("SKILLS_SERVICES_DIR", "").strip()
    if env:
        roots.append(Path(env))
    for index in (3, 2):
        if len(here.parents) > index:
            roots.append(here.parents[index] / "services")
    paths: list[Path] = []
    for root in roots:
        path = root / _TABLE_REL
        if path not in paths:
            paths.append(path)
    return paths


def _load_carbon():
    """Load the existing provincial table. Do not copy its numbers into this file.

    Returns the module, or None after one warning when every candidate is missing.
    """
    global _CARBON
    if _CARBON is False:
        return None
    if _CARBON is not None:
        return _CARBON
    errors: list[str] = []
    for path in _carbon_paths():
        if not path.is_file():
            continue
        try:
            spec = importlib.util.spec_from_file_location("carbon_asset_factors", path)
            if spec is None or spec.loader is None:
                errors.append(f"{path} 无法加载")
                continue
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            if not hasattr(module, "PROVINCIAL_GRID_FACTORS_2023"):
                errors.append(f"{path} 没有 PROVINCIAL_GRID_FACTORS_2023")
                continue
            _CARBON = module
            return module
        except Exception as exc:
            errors.append(f"{path}: {exc}")
    _CARBON = False
    detail = "；".join(errors) if errors else "候选路径上没有 carbon_asset.py"
    logger.warning(
        "省级排放因子表未能加载，报告改用全国因子 %s kg/kWh。%s",
        NATIONAL_FACTOR_KG_PER_KWH,
        detail,
    )
    return None


def resolve_grid_factor(province: str | None = None) -> tuple[float, str]:
    """Return (kgCO2/kWh, sentence). Listed provinces use table 3; otherwise national table 1."""
    if not province:
        return NATIONAL_FACTOR_KG_PER_KWH, _national_sentence()
    module = _load_carbon()
    if module is None:
        return NATIONAL_FACTOR_KG_PER_KWH, _national_sentence()
    name = module.normalize_province(province)
    listed = module.PROVINCIAL_GRID_FACTORS_2023.get(name) if name else None
    if listed is not None:
        sentence = (
            f"按{FACTOR_YEAR}年{FACTOR_SOURCE}附件表3"
            f"{name}省级电力平均二氧化碳排放因子 {listed} kg/kWh 核算"
        )
        return float(listed), sentence
    if name:
        sentence = (
            f"{_national_sentence()}（公告未收录{name}省级因子）"
        )
        return NATIONAL_FACTOR_KG_PER_KWH, sentence
    return NATIONAL_FACTOR_KG_PER_KWH, _national_sentence()


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
