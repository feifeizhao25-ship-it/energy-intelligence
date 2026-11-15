"""Server-side NASA POWER batch import.

This module is the only backend place that names the NASA POWER host.
Request handlers must not import it. The task stays off unless
NENGJIAN_NASA_BATCH_IMPORT=1. The cache file lives on the shared volume
(NENGJIAN_RESOURCE_CACHE), not a container-local /tmp.
NASA POWER data is public; keep the dataset's citation next to the cache.
License note: https://power.larc.nasa.gov/docs/services/request/ (public data,
cite NASA POWER). Do not call this from a user request.
"""
from __future__ import annotations

import json
import os
from pathlib import Path

from app.config import settings

_SEED = Path(__file__).resolve().parents[2] / "data" / "domestic_resources.json"
_CHINA = (18.0, 54.0, 73.0, 135.0)

NASA_POWER_HOST = "power.larc.nasa.gov"
LICENSE_NOTE = "NASA POWER is a public dataset. Cite NASA POWER and do not call it from a user request. Import only in this batch job."


def batch_import_enabled() -> bool:
    return settings.NENGJIAN_NASA_BATCH_IMPORT == "1" and (settings.APP_EDITION or "").lower() == "cn"


def cache_path() -> Path:
    raw = os.environ.get("NENGJIAN_RESOURCE_CACHE", "").strip()
    return Path(raw or "/var/lib/nengjian/nasa-cache.json")


def capital_points() -> list[dict]:
    data = json.loads(_SEED.read_text(encoding="utf-8"))
    points = []
    for row in data.get("stations") or []:
        try:
            points.append({
                "lat": float(row["lat"]),
                "lng": float(row["lng"]),
                "city": row.get("city"),
                "province": row.get("province"),
                "year": 2024,
            })
        except (TypeError, ValueError, KeyError):
            continue
    return points


def grid_points(step: float, limit: int = 80) -> list[dict]:
    if step <= 0:
        return []
    south, north, west, east = _CHINA
    points = []
    lat = south
    while lat <= north and len(points) < limit:
        lng = west
        while lng <= east and len(points) < limit:
            points.append({"lat": round(lat, 4), "lng": round(lng, 4), "city": "", "province": "网格", "year": 2024})
            lng += step
        lat += step
    return points


def extra_points() -> list[dict]:
    raw = os.environ.get("NENGJIAN_NASA_POINTS", "").strip()
    points = []
    for item in raw.split(";"):
        item = item.strip()
        if not item or "," not in item:
            continue
        lat_s, lng_s = item.split(",", 1)
        try:
            points.append({"lat": float(lat_s), "lng": float(lng_s), "city": "", "province": "指定点", "year": 2024})
        except ValueError:
            continue
    return points


def default_points() -> list[dict]:
    points = capital_points()
    raw_step = os.environ.get("NENGJIAN_NASA_GRID", "").strip()
    if raw_step:
        try:
            points.extend(grid_points(float(raw_step)))
        except ValueError:
            pass
    points.extend(extra_points())
    return points


def planned_monthly_url(lat: float, lng: float, year: int) -> str:
    return (
        f"https://{NASA_POWER_HOST}/api/temporal/monthly/point"
        f"?parameters=ALLSKY_SFC_SW_DWN,T2M,WS50M&community=RE&start={year}&end={year}"
        f"&latitude={lat}&longitude={lng}&time-standard=UTC&format=JSON"
    )


def _fetch(url: str) -> str:
    """The only function in this module that opens a socket. Request handlers must not call it."""
    import urllib.request
    req = urllib.request.Request(url, headers={"User-Agent": "nengjian-nasa-batch/1.0"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.read().decode("utf-8", errors="replace")


def run_batch(points: list[dict], cache_path: Path, fetcher=None) -> dict:
    if not batch_import_enabled():
        return {"status": "disabled", "written": 0, "license_note": LICENSE_NOTE, "fetched": False}
    fetch = fetcher or _fetch
    rows = []
    for point in points:
        lat = float(point["lat"])
        lng = float(point["lng"])
        year = int(point.get("year") or 2024)
        url = planned_monthly_url(lat, lng, year)
        try:
            body = fetch(url)
            parsed = json.loads(body) if body else {}
            rows.append({"lat": lat, "lng": lng, "year": year, "fetched": True, "body": parsed, "city": point.get("city"), "province": point.get("province")})
        except Exception as exc:
            rows.append({"lat": lat, "lng": lng, "year": year, "fetched": False, "error": exc.__class__.__name__})
    stations = []
    for row in rows:
        if not row.get("fetched"):
            continue
        stations.append({
            "lat": row["lat"], "lng": row["lng"], "city": row.get("city"), "province": row.get("province"),
            "provenance": "NASA POWER 批量导入缓存",
            "license_note": LICENSE_NOTE,
            "nasa": row.get("body"),
        })
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    cache_path.write_text(json.dumps({"points": rows, "stations": stations, "license_note": LICENSE_NOTE}, ensure_ascii=False), encoding="utf-8")
    return {"status": "imported", "written": len(rows), "license_note": LICENSE_NOTE, "fetched": any(row.get("fetched") for row in rows)}
