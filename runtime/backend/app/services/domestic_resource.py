"""国内用户请求只读本地辐照/风速样本或批量导入缓存。

本模块不发起 HTTP，也不导入 nasa_batch_import（那个模块才允许在开关打开时
访问 power.larc.nasa.gov）。种子数据是省级城市的气候量级示例，不是 NASA 实测。
"""
from __future__ import annotations

import json
import math
import os
from functools import lru_cache
from pathlib import Path

_SEED = Path(__file__).resolve().parents[2] / "data" / "domestic_resources.json"


class DomesticResourceNotLoaded(LookupError):
    """坐标附近没有已加载的国内样本或批量缓存。"""

    code = "DOMESTIC_RESOURCE_NOT_LOADED"
    message = "该坐标的辐照数据尚未加载。请改用已覆盖的省会坐标，或等待服务端批量导入完成。"


@lru_cache(maxsize=1)
def _seed() -> dict:
    return json.loads(_SEED.read_text(encoding="utf-8"))


def _cache_rows() -> list[dict]:
    raw = os.environ.get("NENGJIAN_RESOURCE_CACHE", "")
    if not raw:
        return []
    path = Path(raw)
    if not path.is_file():
        return []
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []
    rows = payload.get("stations") or payload.get("points") or []
    return [row for row in rows if isinstance(row, dict) and "lat" in row and "lng" in row]


def _nearest(lat: float, lng: float) -> dict | None:
    limit = float(_seed().get("match_degrees") or 0.85)
    best = None
    best_d = limit
    for row in list(_cache_rows()) + list(_seed().get("stations") or []):
        try:
            d = math.hypot(float(row["lat"]) - lat, float(row["lng"]) - lng)
        except (TypeError, ValueError, KeyError):
            continue
        if d <= best_d:
            best, best_d = row, d
    return best


def lookup(lat: float, lng: float) -> dict:
    row = _nearest(lat, lng)
    if row is None:
        raise DomesticResourceNotLoaded(DomesticResourceNotLoaded.message)
    monthly = list(row.get("monthly_ghi") or [])
    if len(monthly) != 12:
        raise DomesticResourceNotLoaded(DomesticResourceNotLoaded.message)
    return {
        "lat": lat,
        "lng": lng,
        "station_city": row.get("city"),
        "station_province": row.get("province"),
        "ghi_annual": float(row.get("ghi_annual") or sum(monthly)),
        "monthly_ghi": [float(v) for v in monthly],
        "avg_temp": float(row.get("avg_temp") or 15),
        "monthly_temp": list(row.get("monthly_temp") or [float(row.get("avg_temp") or 15)] * 12),
        "mean_wind_100m": float(row.get("mean_wind_100m") or 0),
        "monthly_wind_100m": [float(v) for v in (row.get("monthly_wind_100m") or [float(row.get("mean_wind_100m") or 0)] * 12)],
        "data_source": row.get("provenance") or "国内离线辐照与风速样本（省级城市）",
        "license_note": row.get("license_note") or _seed().get("license_note"),
        "station_note": f"匹配 {row.get('province') or ''}{row.get('city') or ''}，返回坐标为请求坐标",
    }


def solar_response_fields(lat: float, lng: float) -> dict:
    row = lookup(lat, lng)
    annual = row["ghi_annual"]
    monthly = row["monthly_ghi"]
    dni = [round(v * 0.55, 1) for v in monthly]
    dhi = [round(v * 0.45, 1) for v in monthly]
    if annual >= 2000:
        klass, score = "I", 80.0
    elif annual >= 1600:
        klass, score = "II", 60.0
    elif annual >= 1200:
        klass, score = "III", 40.0
    else:
        klass, score = "IV", 20.0
    return {
        "lat": lat,
        "lng": lng,
        "ghi": round(annual, 1),
        "dni": round(sum(dni), 1),
        "dhi": round(sum(dhi), 1),
        "peak_sun_hours": round(annual / 365, 2),
        "optimal_tilt": round(abs(lat) * 0.76 + 3.1, 1),
        "avg_temperature": round(row["avg_temp"], 1),
        "resource_class": klass,
        "score": score,
        "data_source": row["data_source"],
        "monthly_ghi": [round(v, 1) for v in monthly],
    }


def nasa_shaped(lat: float, lng: float) -> dict:
    row = lookup(lat, lng)
    annual = row["ghi_annual"]
    return {
        "ghi_annual": round(annual, 1),
        "dni_annual": round(annual * 0.55, 1),
        "dhi_annual": round(annual * 0.45, 1),
        "temp_avg": round(row["avg_temp"], 1),
        "data_source": row["data_source"],
        "data_period": "domestic-seed",
        "license_note": row["license_note"],
        "station_note": row["station_note"],
    }


def wind_response_fields(lat: float, lng: float) -> dict:
    row = lookup(lat, lng)
    monthly = row["monthly_wind_100m"] or [row["mean_wind_100m"]] * 12
    if len(monthly) != 12:
        monthly = [row["mean_wind_100m"]] * 12
    mean_speed = sum(monthly) / 12
    if mean_speed <= 0:
        raise DomesticResourceNotLoaded(DomesticResourceNotLoaded.message)
    k = 2.0
    c_weibull = mean_speed / 0.886
    rho = 1.225
    mean_cubed = sum(v ** 3 for v in monthly) / 12
    wpd = 0.5 * rho * mean_cubed
    if wpd >= 400:
        klass, score = "I", 80.0
    elif wpd >= 300:
        klass, score = "II", 60.0
    elif wpd >= 200:
        klass, score = "III", 40.0
    else:
        klass, score = "IV", 20.0
    return {
        "lat": lat,
        "lng": lng,
        "mean_speed": round(mean_speed, 2),
        "weibull_k": round(k, 2),
        "weibull_c": round(c_weibull, 2),
        "wind_power_density": round(wpd, 1),
        "turbulence_intensity": 0.11,
        "resource_class": klass,
        "score": round(score, 1),
        "monthly_speed": [round(v, 1) for v in monthly],
        "data_source": row["data_source"],
    }
