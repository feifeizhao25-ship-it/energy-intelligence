"""PVWatts and PVGIS scoring stays off unless EXTERNAL_GOLDEN_SCORING=1.

Even then this build does not call either provider. There is no client and no key here.
"""
from __future__ import annotations

import os
from typing import Mapping

PROVIDERS = ("PVWatts", "PVGIS")


def external_golden_enabled(env: Mapping[str, str] | None = None) -> bool:
    source = os.environ if env is None else env
    return str(source.get("EXTERNAL_GOLDEN_SCORING", "")).strip() == "1"


def external_golden_score(kind: str, env: Mapping[str, str] | None = None) -> dict:
    if not external_golden_enabled(env):
        reason = "EXTERNAL_GOLDEN_SCORING is off"
    else:
        reason = "flag is on, but this build does not call PVWatts or PVGIS"
    return {"kind": kind, "available": False, "reason": reason, "providers": list(PROVIDERS), "score": None}
