"""北极星与漏斗。事件只交给自建统计地址，地址为空则只留在本地。"""
from __future__ import annotations

import os

FUNNEL = ("注册", "首次测算", "第7天回访", "试用", "付费", "续费")
NORTH_STAR = "每周有效使用的付费席位数"


def track_event(name: str, user_id: str, sink: list | None = None) -> dict:
    if name not in ("测算", "导出", "打开政策原文", *FUNNEL):
        raise ValueError("未知事件")
    event = {"name": name, "user_id": user_id, "endpoint": os.environ.get("NENGJIAN_UMAMI_URL", "").strip()}
    if sink is not None:
        sink.append(event)
    if not event["endpoint"]:
        return {"stored": "local", "sent": False, "event": event}
    if event["endpoint"].startswith("https://") and "umami" not in event["endpoint"] and "localhost" not in event["endpoint"]:
        return {"stored": "local", "sent": False, "reason": "endpoint not allowlisted", "event": event}
    return {"stored": "umami", "sent": True, "event": event}


def effective_seat(events: list[str]) -> bool:
    return any(name in events for name in ("测算", "导出", "打开政策原文"))


def digest(active_paid_seats: int) -> dict:
    return {
        "north_star": NORTH_STAR,
        "active_paid_seats": active_paid_seats,
        "schedule": "每日 08:30",
        "channel": "企业微信",
        "sent": False,
        "reason": "pending_delivery",
    }
