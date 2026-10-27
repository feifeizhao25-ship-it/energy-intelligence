"""关注项的推送频率。即时、每日汇总、每周。"""
from __future__ import annotations

from datetime import datetime, timedelta

INSTANT = {"instant", "即时", ""}
DAILY = {"daily", "每日汇总"}
WEEKLY = {"weekly", "每周"}


def allows_send(frequency: str | None, last_sent: datetime | None, now: datetime) -> bool:
    name = (frequency or "即时").strip()
    if name in INSTANT or name == "即时":
        return True
    if last_sent is None:
        return True
    elapsed = now - last_sent
    if name in DAILY:
        return elapsed >= timedelta(hours=20)
    if name in WEEKLY:
        return elapsed >= timedelta(days=6)
    return True
