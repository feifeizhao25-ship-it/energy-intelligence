"""用户自填的企业微信群机器人。密钥缺失或已解绑则不推送。"""
from __future__ import annotations

from datetime import datetime

_bindings: dict[str, dict] = {}


def bind_webhook(user_id: str, webhook_url: str, now: datetime | None = None) -> dict:
    if not user_id or not (webhook_url or "").strip():
        return {"bound": False, "reason": "webhook missing"}
    _bindings[user_id] = {"url": webhook_url.strip(), "unbound_at": None, "bound_at": now or datetime.now()}
    return {"bound": True, "user_id": user_id}


def unbind_webhook(user_id: str, now: datetime | None = None) -> dict:
    row = _bindings.get(user_id)
    if not row:
        return {"unbound": True, "user_id": user_id}
    row["unbound_at"] = now or datetime.now()
    row["url"] = ""
    return {"unbound": True, "user_id": user_id, "unbound_at": row["unbound_at"].isoformat()}


def push_allowed(user_id: str, now: datetime | None = None) -> bool:
    row = _bindings.get(user_id)
    if not row or not row.get("url"):
        return False
    if row.get("unbound_at") is not None:
        return False
    return True


def reset_webhooks() -> None:
    _bindings.clear()
