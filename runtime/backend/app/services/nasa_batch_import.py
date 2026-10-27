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


def run_batch(points: list[dict], cache_path: Path) -> dict:
    if not batch_import_enabled():
        return {"status": "disabled", "written": 0, "license_note": LICENSE_NOTE}
    # TODO: perform the HTTP GET only inside this function when operations
    # enables the flag. The default path writes nothing and does not open a socket.
    cache_path.write_text(json.dumps({"points": points, "license_note": LICENSE_NOTE}, ensure_ascii=False), encoding="utf-8")
    return {"status": "staged", "written": len(points), "license_note": LICENSE_NOTE, "fetched": False}
