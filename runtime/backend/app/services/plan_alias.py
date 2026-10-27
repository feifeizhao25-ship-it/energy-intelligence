"""内部档位 id 与名称对齐。存量会员仍用 pro / full，请求里的新 id 映射回去。"""
from __future__ import annotations

STORED_BY_CANONICAL = {
    "free": "free",
    "standard": "pro",
    "professional": "full",
    "pro": "pro",
    "full": "full",
    "team": "team",
    "enterprise": "enterprise",
}

CANONICAL_BY_STORED = {
    "free": "free",
    "pro": "standard",
    "full": "professional",
    "team": "team",
    "enterprise": "enterprise",
}


def stored_plan_id(raw: str) -> str:
    key = (raw or "").strip().lower()
    if key not in STORED_BY_CANONICAL:
        raise ValueError("未知档位")
    return STORED_BY_CANONICAL[key]


def canonical_plan_id(stored: str) -> str:
    key = (stored or "").strip().lower()
    if key not in CANONICAL_BY_STORED:
        raise ValueError("未知档位")
    return CANONICAL_BY_STORED[key]
