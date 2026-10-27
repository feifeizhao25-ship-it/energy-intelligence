"""口径咨询预约。没有企业微信批准记录时不得通过。"""
from __future__ import annotations

import hashlib

from ops.wecom import approval_allows, submit_approval


def book_consultation(topic: str, user_id: str) -> dict:
    clean = (topic or "").strip()
    if not clean:
        return {"status": "invalid", "approved": False, "message": "请填写咨询主题"}
    digest = hashlib.sha256(f"{user_id}:{clean}".encode()).hexdigest()
    wecom = submit_approval("business", digest)
    approved = approval_allows(wecom if wecom.get("submitted") else None, digest)
    return {
        "status": "pending",
        "approved": bool(approved),
        "topic": clean,
        "user_id": user_id,
        "content_sha256": digest,
        "wecom": wecom,
        "message": "已登记，等待企业微信审批。不会自动通过。",
    }
