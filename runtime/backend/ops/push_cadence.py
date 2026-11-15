"""推送窗口、周末与国务院办公厅放假安排。

窗口为北京时间 08:00–21:30。周末和放假日只允许周报，仍须落在窗口内。
调休上班日按工作日处理。
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

SHANGHAI = timezone(timedelta(hours=8))
WINDOW_START = 8 * 60
WINDOW_END = 21 * 60 + 30
TABLE_PATH = Path(__file__).resolve().parents[1] / "data" / "holidays" / "2026.json"


def load_table(path: Path | None = None) -> dict:
    return json.loads((path or TABLE_PATH).read_text(encoding="utf-8"))


def to_shanghai(moment: datetime) -> datetime:
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=SHANGHAI)
    return moment.astimezone(SHANGHAI)


def _quiet_day(day, table: dict) -> bool:
    iso = day.isoformat()
    if iso in set(table.get("off") or []):
        return True
    if day.weekday() >= 5 and iso not in set(table.get("work") or []):
        return True
    return False


def allow_push(moment: datetime, kind: str = "即时", table: dict | None = None) -> bool:
    local = to_shanghai(moment)
    minutes = local.hour * 60 + local.minute
    if minutes < WINDOW_START or minutes > WINDOW_END:
        return False
    holidays = table if table is not None else load_table()
    if _quiet_day(local.date(), holidays) and kind != "周报":
        return False
    return True


ROLE_SUFFIX = {
    "ci_owner": "总",
    "developer": "经理",
    "researcher": "老师",
    "government": "老师",
    "epc": "老师",
    "student": "同学",
}


def salutation(role: str, surname: str, mode: str = "role", sub_role: str = "") -> str:
    if mode == "none" or not (surname or "").strip():
        return ""
    if sub_role == "student" or role == "student":
        return "同学"
    suffix = ROLE_SUFFIX.get(role)
    if not suffix:
        return ""
    return surname.strip() + suffix
