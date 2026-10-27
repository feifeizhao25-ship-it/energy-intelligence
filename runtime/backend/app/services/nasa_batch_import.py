"""Server-side NASA POWER batch import.

This module is the only backend place that names the NASA POWER host.
Request handlers must not import it. The task stays off unless
NENGJIAN_NASA_BATCH_IMPORT=1, and even then it writes a local cache file.
NASA POWER data is public; keep the dataset's citation next to the cache.
License note: https://power.larc.nasa.gov/docs/services/request/ (public data,
cite NASA POWER). Do not call this from a user request.
"""
from __future__ import annotations

import json
from pathlib import Path

from app.config import settings

NASA_POWER_HOST = "power.larc.nasa.gov"
LICENSE_NOTE = "NASA POWER is a public dataset. Cite NASA POWER and do not call it from a user request. Import only in this batch job."


def batch_import_enabled() -> bool:
    return settings.NENGJIAN_NASA_BATCH_IMPORT == "1" and (settings.APP_EDITION or "").lower() == "cn"


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
    cache_path.write_text(json.dumps({"points": rows, "stations": stations, "license_note": LICENSE_NOTE}, ensure_ascii=False), encoding="utf-8")
    return {"status": "imported", "written": len(rows), "license_note": LICENSE_NOTE, "fetched": any(row.get("fetched") for row in rows)}
