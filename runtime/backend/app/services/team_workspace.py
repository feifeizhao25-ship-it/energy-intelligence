"""Real team seats. Empty until a member is invited. No sample people."""
from __future__ import annotations

import json
import os
from pathlib import Path

from app.core.subscription import ENTITLEMENTS

ROLES = ("admin", "member", "readonly_advisor")


def seat_limit(plan: str) -> int:
    tier = ENTITLEMENTS.get(plan or "free") or ENTITLEMENTS["free"]
    seats = int(tier.get("team_seats") or 1)
    return max(1, seats)


def _path() -> Path:
    raw = (os.environ.get("TEAM_WORKSPACE_PATH") or "").strip()
    if raw:
        return Path(raw)
    return Path(__file__).resolve().parents[2] / "data" / "team_workspaces.json"


def _load() -> dict:
    path = _path()
    if not path.is_file():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    return data if isinstance(data, dict) else {}


def _save(data: dict) -> None:
    path = _path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def _owner(user_id: str, label: str) -> dict:
    return {"id": user_id, "label": label or "账户所有者", "role": "admin"}


def view(user_id: str, plan: str, label: str = "") -> dict:
    stored = _load().get(user_id) or {}
    seats = stored.get("seats") if isinstance(stored.get("seats"), list) else []
    if not any(seat.get("id") == user_id for seat in seats):
        seats = [_owner(user_id, label)] + [seat for seat in seats if seat.get("id") != user_id]
    limit = seat_limit(plan)
    return {
        "seats": seats[:limit],
        "limit": limit,
        "used": min(len(seats), limit),
        "remaining": max(0, limit - len(seats)),
        "plan": plan or "free",
    }


def invite(user_id: str, plan: str, member_id: str, role: str, label: str = "") -> dict:
    member_id = (member_id or "").strip()
    role = role if role in ROLES else "member"
    if not member_id:
        return {"ok": False, "reason": "请填写成员标识"}
    current = view(user_id, plan, label)
    seats = list(current["seats"])
    if any(seat.get("id") == member_id for seat in seats):
        return {"ok": False, "reason": "成员已在团队中", **current}
    if len(seats) >= current["limit"]:
        return {"ok": False, "reason": "席位已满", **current}
    seats.append({"id": member_id, "label": member_id, "role": role})
    data = _load()
    data[user_id] = {"seats": seats}
    _save(data)
    return {"ok": True, **view(user_id, plan, label)}


def remove(user_id: str, plan: str, member_id: str, label: str = "") -> dict:
    if member_id == user_id:
        return {"ok": False, "reason": "不能移除团队所有者", **view(user_id, plan, label)}
    current = view(user_id, plan, label)
    seats = [seat for seat in current["seats"] if seat.get("id") != member_id]
    data = _load()
    data[user_id] = {"seats": seats}
    _save(data)
    return {"ok": True, **view(user_id, plan, label)}
