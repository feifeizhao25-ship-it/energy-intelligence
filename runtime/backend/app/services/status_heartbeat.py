"""服务心跳。超过两日未确认则标记升级，不编造可用率。"""

from __future__ import annotations

import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path


def heartbeat_path() -> Path | None:
    raw = os.environ.get("NENGJIAN_HEARTBEAT_FILE", "").strip()
    return Path(raw) if raw else None


def read_heartbeat(path: Path | None = None) -> dict:
    target = path or heartbeat_path()
    if target is None or not target.exists():
        return {"lastSeen": None, "acknowledgedAt": None}
    try:
        payload = json.loads(target.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {"lastSeen": None, "acknowledgedAt": None}
    return {"lastSeen": payload.get("lastSeen"), "acknowledgedAt": payload.get("acknowledgedAt")}


def write_heartbeat(path: Path, *, now: datetime | None = None, acknowledge: bool = False) -> dict:
    current = read_heartbeat(path) if path.exists() else {"lastSeen": None, "acknowledgedAt": None}
    moment = (now or datetime.now(timezone.utc)).astimezone(timezone.utc).isoformat()
    payload = {
        "lastSeen": moment,
        "acknowledgedAt": moment if acknowledge else current.get("acknowledgedAt"),
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload), encoding="utf-8")
    return payload


def heartbeat_level(payload: dict, *, now: datetime | None = None) -> str:
    moment = now or datetime.now(timezone.utc)
    raw = payload.get("acknowledgedAt")
    if not raw:
        return "missing"
    try:
        acked = datetime.fromisoformat(raw)
    except ValueError:
        return "missing"
    if acked.tzinfo is None:
        acked = acked.replace(tzinfo=timezone.utc)
    if moment - acked > timedelta(days=2):
        return "escalate"
    return "ok"
