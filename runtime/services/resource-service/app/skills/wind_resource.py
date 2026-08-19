"""RA-002 风能资源评估技能（恢复重建版）。

真实计算逻辑：
1. 调用方提供实测 50m 年均风速（mean_speed_ms）时直接使用；
2. 否则请求 NASA POWER climatology API 获取多年平均风速；
3. 外部 API 不可达时：生产环境 fail-closed 抛错，开发环境返回带
   engine/来源标注的启发式估算。

分级阈值复用 后端/app/services/resource_service.py 的 _classify_wind；
产能系数估算复用 后端/app/utils/wind_calculations.py 的 capacity_factor_estimate。
"""

from __future__ import annotations

import os
from typing import Any, Awaitable, Callable, Dict, Optional

try:
    from app.services.resource_service import _classify_wind
    from app.utils.wind_calculations import capacity_factor_estimate
except ImportError:  # 注册表从其他工作目录加载本文件时，补后端路径
    import sys
    from pathlib import Path

    _BACKEND_DIR = Path(__file__).resolve().parents[4] / "后端"
    if str(_BACKEND_DIR) not in sys.path:
        sys.path.insert(0, str(_BACKEND_DIR))
    from app.services.resource_service import _classify_wind
    from app.utils.wind_calculations import capacity_factor_estimate

NASA_POWER_URL = "https://power.larc.nasa.gov/api/temporal/climatology/point"

# 标准空气密度 kg/m³（IEC 61400-12-1 标准大气条件）
AIR_DENSITY = 1.225
HOURS_PER_YEAR = 8760.0


def _is_production() -> bool:
    return (
        os.getenv("ENVIRONMENT", "").lower() == "production"
        or os.getenv("APP_ENV", "").lower() == "production"
    )


async def _fetch_mean_speed_nasa(latitude: float, longitude: float) -> float:
    """从 NASA POWER 获取多年平均 50m 风速，返回 m/s。"""
    import httpx

    params = {
        "parameters": "WS50M",
        "community": "RE",
        "longitude": longitude,
        "latitude": latitude,
        "format": "JSON",
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(NASA_POWER_URL, params=params)
        resp.raise_for_status()
        payload = resp.json()
    mean_speed = float(payload["properties"]["parameter"]["WS50M"]["ANN"])
    if mean_speed <= 0:
        raise ValueError(f"NASA POWER 返回无效风速: {mean_speed}")
    return mean_speed


def _estimate_mean_speed_heuristic(latitude: float) -> float:
    """开发环境兜底：启发式风速估算（m/s），结果必须标注为估算。"""
    return 6.5


def assess_wind_resource(mean_speed: float, capacity_mw: float = 1.0) -> Dict[str, Any]:
    """纯函数：年均风速 → 风功率密度 / 分级 / 年等效利用小时 / 产能系数区间。

    - 风功率密度 WPD = 0.5 × ρ × v³（ρ = 1.225 kg/m³）
    - 分级复用 _classify_wind（I≥400, II≥300, III≥200, IV<200 W/m²）
    - 产能系数复用 capacity_factor_estimate，区间取风速 ±5% 的估算值
    """
    wpd = 0.5 * AIR_DENSITY * mean_speed ** 3
    resource_class, score = _classify_wind(wpd)
    cf_mid = capacity_factor_estimate(mean_speed)
    cf_low = capacity_factor_estimate(mean_speed * 0.95)
    cf_high = capacity_factor_estimate(mean_speed * 1.05)
    hours_mid = cf_mid * HOURS_PER_YEAR
    return {
        "mean_speed_ms": round(mean_speed, 2),
        "wind_power_density": round(wpd, 1),
        "resource_class": resource_class,
        "score": round(score, 1),
        "equivalent_hours": round(hours_mid, 1),
        "capacity_factor": round(cf_mid, 4),
        "capacity_factor_range": [round(cf_low, 4), round(cf_high, 4)],
        "annual_generation_mwh": round(capacity_mw * hours_mid, 1),
    }


class WindResourceSkill:
    """RA-002 风能资源评估。"""

    skill_id = "RA-002"
    name = "风能资源评估"
    description = (
        "基于实测风速或 NASA POWER 气象数据评估风功率密度等级、"
        "年等效利用小时与产能系数区间；外部数据不可达时生产环境 fail-closed。"
    )
    category = "RA"
    references = [
        "GB/T 18710-2002 风电场风能资源评估方法",
        "IEC 61400-12-1 风电机组功率特性测试（标准空气密度 1.225 kg/m³）",
        "NREL Wind Toolkit / NASA POWER climatology",
    ]

    def __init__(
        self,
        fetcher: Optional[Callable[[float, float], Awaitable[float]]] = None,
    ) -> None:
        self._fetcher = fetcher if fetcher is not None else _fetch_mean_speed_nasa

    async def execute(self, params: Dict[str, Any]) -> Dict[str, Any]:
        latitude = params.get("latitude")
        longitude = params.get("longitude")
        if latitude is None or longitude is None:
            raise ValueError("RA-002 需要 latitude/longitude 参数")
        latitude = float(latitude)
        longitude = float(longitude)
        capacity_mw = float(params.get("capacity_mw", 1.0))
        market = params.get("market", "cn")

        measured = params.get("mean_speed_ms")
        estimated = False
        if measured is not None:
            mean_speed = float(measured)
            engine = "measured_input"
            data_source = "user_provided"
        else:
            try:
                mean_speed = await self._fetcher(latitude, longitude)
                engine = "nasa_power"
                data_source = "NASA POWER climatology"
            except Exception as exc:
                if _is_production():
                    raise RuntimeError(
                        "RA-002 外部气象数据不可达，生产环境拒绝返回合成估算结果: "
                        f"{exc}"
                    ) from exc
                mean_speed = _estimate_mean_speed_heuristic(latitude)
                engine = "heuristic_estimate"
                data_source = "estimate"
                estimated = True

        result = assess_wind_resource(mean_speed, capacity_mw)
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
