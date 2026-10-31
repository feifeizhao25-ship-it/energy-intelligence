"""Request market resolution shared by every per-market endpoint.

The international apps send ``X-App-Market: global`` (older builds send ``X-Market``). Anything else, or no header,
is the domestic market. Endpoints that used to return Chinese text and CNY to every caller must branch on this.
"""
from __future__ import annotations

from typing import Optional

from fastapi import Request

GLOBAL_VALUES = frozenset({"global", "intl", "int", "international", "en", "overseas"})


def is_global_value(value: Optional[str]) -> bool:
    return bool(value) and str(value).strip().lower() in GLOBAL_VALUES


def request_market(request: Request, explicit: Optional[str] = None) -> str:
    """'global' or 'cn'. Order: explicit query/body value, X-App-Market, X-Market."""
    for cand in (explicit, request.headers.get("x-app-market"), request.headers.get("x-market")):
        if cand:
            return "global" if is_global_value(cand) else "cn"
    return "cn"
