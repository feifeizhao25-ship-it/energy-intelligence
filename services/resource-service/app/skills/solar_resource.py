"""RA-001 太阳能资源评估技能（恢复重建版）。

真实计算逻辑：
1. 调用方提供实测年总辐射（ghi_annual_kwh_m2）时直接使用；
2. 否则请求 NASA POWER climatology API 获取多年平均 GHI；
3. 外部 API 不可达时：生产环境 fail-closed 抛错（严禁合成数据冒充真实结果），
   开发环境返回带 engine/来源标注的纬度启发式估算。

分级阈值复用 后端/app/services/resource_service.py 的 _classify_solar。
"""

from __future__ import annotations

import os
from typing import Any, Awaitable, Callable, Dict, List, Optional

try:
    from app.services.resource_service import _classify_solar
    from app.utils.solar_calculations import sunbelt_factor
except ImportError:  # 注册表从其他工作目录加载本文件时，补后端路径
    import sys
    from pathlib import Path

    _BACKEND_DIR = Path(__file__).resolve().parents[4] / "后端"
    if str(_BACKEND_DIR) not in sys.path:
        sys.path.insert(0, str(_BACKEND_DIR))
    from app.services.resource_service import _classify_solar
    from app.utils.solar_calculations import sunbelt_factor

NASA_POWER_URL = "https://power.larc.nasa.gov/api/temporal/climatology/point"

# IEC 61724-1 典型系统效率（Performance Ratio）区间
PR_LOW = 0.78
PR_MID = 0.82
PR_HIGH = 0.86
HOURS_PER_YEAR = 8760.0


def _is_production() -> bool:
    return (
        os.getenv("ENVIRONMENT", "").lower() == "production"
        or os.getenv("APP_ENV", "").lower() == "production"
    )


async def _fetch_ghi_nasa(latitude: float, longitude: float) -> float:
    """从 NASA POWER 获取多年平均 GHI，返回 kWh/m²/年。"""
    import httpx

    params = {
        "parameters": "ALLSKY_SFC_SW_DWN",
        "community": "RE",
        "longitude": longitude,
        "latitude": latitude,
        "format": "JSON",
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(NASA_POWER_URL, params=params)
        resp.raise_for_status()
        payload = resp.json()
    daily_avg = float(payload["properties"]["parameter"]["ALLSKY_SFC_SW_DWN"]["ANN"])
    ghi_annual = daily_avg * 365.0  # kWh/m²/day → kWh/m²/yr
    if ghi_annual <= 0:
        raise ValueError(f"NASA POWER 返回无效 GHI: {ghi_annual}")
    return ghi_annual


def _estimate_ghi_from_latitude(latitude: float) -> float:
    """开发环境兜底：纬度启发式 GHI 估算（kWh/m²/年），结果必须标注为估算。"""
    return 1200.0 + 1000.0 * sunbelt_factor(latitude)


def assess_solar_resource(ghi_annual: float, capacity_mw: float = 1.0) -> Dict[str, Any]:
    """纯函数：GHI → 分级 / 年等效利用小时 / 产能系数区间。

    - 分级复用 _classify_solar（I≥2000, II≥1600, III≥1200, IV<1200）
    - 年等效利用小时 = GHI × PR（IEC 61724 典型 PR 区间 0.78–0.86，中值 0.82）
    - 产能系数 = 等效利用小时 / 8760
    """
    resource_class, score = _classify_solar(ghi_annual)
    hours_mid = ghi_annual * PR_MID
    hours_low = ghi_annual * PR_LOW
    hours_high = ghi_annual * PR_HIGH
    return {
        "ghi_annual_kwh_m2": round(ghi_annual, 1),
        "resource_class": resource_class,
        "score": round(score, 1),
        "peak_sun_hours_daily": round(ghi_annual / 365.0, 2),
        "equivalent_hours": round(hours_mid, 1),
        "equivalent_hours_range": [round(hours_low, 1), round(hours_high, 1)],
        "capacity_factor": round(hours_mid / HOURS_PER_YEAR, 4),
        "capacity_factor_range": [
            round(hours_low / HOURS_PER_YEAR, 4),
            round(hours_high / HOURS_PER_YEAR, 4),
        ],
        "annual_generation_mwh": round(capacity_mw * hours_mid, 1),
    }


class SolarResourceSkill:
    """RA-001 太阳能资源评估。"""

    skill_id = "RA-001"
    aliases = ["F-001"]  # 运营规格首发编号：F-001 太阳能资源评估
    name = "太阳能资源评估"
    description = (
        "基于实测 GHI 或 NASA POWER 气象数据评估太阳能资源等级、"
        "年等效利用小时与产能系数区间；外部数据不可达时生产环境 fail-closed。"
    )
    category = "RA"
    references = [
        "GB/T 31155-2014 太阳能资源等级 总辐射",
        "IEC 61724-1:2021 光伏系统性能监测（PR 典型区间 0.78–0.86）",
        "NREL National Solar Radiation Database / NASA POWER climatology",
    ]

    def __init__(
        self,
        fetcher: Optional[Callable[[float, float], Awaitable[float]]] = None,
    ) -> None:
        self._fetcher = fetcher if fetcher is not None else _fetch_ghi_nasa

    async def execute(self, params: Dict[str, Any]) -> Dict[str, Any]:
        latitude = params.get("latitude")
        longitude = params.get("longitude")
        if latitude is None or longitude is None:
            raise ValueError("RA-001 需要 latitude/longitude 参数")
        latitude = float(latitude)
        longitude = float(longitude)
        capacity_mw = float(params.get("capacity_mw", 1.0))
        market = params.get("market", "cn")

        measured = params.get("ghi_annual_kwh_m2")
        estimated = False
        if measured is not None:
            ghi_annual = float(measured)
            engine = "measured_input"
            data_source = "user_provided"
        else:
            try:
                ghi_annual = await self._fetcher(latitude, longitude)
                engine = "nasa_power"
                data_source = "NASA POWER climatology"
            except Exception as exc:
                if _is_production():
                    raise RuntimeError(
                        "RA-001 外部气象数据不可达，生产环境拒绝返回合成估算结果: "
                        f"{exc}"
                    ) from exc
                ghi_annual = _estimate_ghi_from_latitude(latitude)
                engine = "heuristic_latitude_estimate"
                data_source = "estimate"
                estimated = True

        result = assess_solar_resource(ghi_annual, capacity_mw)
        result.update(
            {
                "skill_id": self.skill_id,
                "latitude": latitude,
                "longitude": longitude,
                "market": market,
                "engine": engine,
                "data_source": data_source,
                "estimated": estimated,
                "references": list(self.references),
            }
        )
        if estimated:
            result["warning"] = (
                "Estimated demonstration result — not a live measurement"
                if market == "global"
                else "启发式估算结果——非实测数据，仅供开发环境演示"
            )
        return result
