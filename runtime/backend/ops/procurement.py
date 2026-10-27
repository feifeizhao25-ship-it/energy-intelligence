"""机构采购材料。四项开票信息收齐后才进入企业微信，批准前不外发。"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

REQUIRED = ("account_name", "bank_name", "account_number", "tax_id")


def open_procurement(fields: dict, now: datetime | None = None) -> dict:
    moment = now or datetime.now(timezone(timedelta(hours=8)))
    missing = [key for key in REQUIRED if not str(fields.get(key) or "").strip()]
    return {
        "status": "pending_wecom" if not missing else "incomplete",
        "missing": missing,
        "sent": False,
        "approved": False,
        "opened_at": moment.isoformat(),
    }
