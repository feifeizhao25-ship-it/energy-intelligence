"""六类企业微信审批。48 小时未处理自动作废，不会自动外发。"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

BEIJING = timezone(timedelta(hours=8))
KINDS = ("政策入库", "对外发布", "报价偏离", "退款", "勘误", "专家抽检")
WINDOW = timedelta(hours=48)


def open_request(kind: str, content_sha256: str, now: datetime | None = None) -> dict:
    if kind not in KINDS:
        raise ValueError("未知审批类型")
    moment = now or datetime.now(BEIJING)
    return {
        "kind": kind,
        "content_sha256": content_sha256,
        "status": "pending_wecom",
        "opened_at": moment.isoformat(),
        "expires_at": (moment + WINDOW).isoformat(),
        "sent": False,
    }


def resolve_request(request: dict, decision: str | None, now: datetime) -> dict:
    expires = datetime.fromisoformat(request["expires_at"])
    if decision is None and now >= expires:
        return {**request, "status": "void", "sent": False, "reason": "48 小时未处理，自动作废"}
    if decision == "approved" and now < expires:
        return {**request, "status": "approved", "sent": False, "reason": "已批准，仍需人工发出"}
    if decision == "rejected":
        return {**request, "status": "rejected", "sent": False}
    return {**request, "sent": False}
