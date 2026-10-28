"""机构采购材料。四项开票信息收齐后才进入企业微信，批准前不外发。"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

REQUIRED = ("account_name", "bank_name", "account_number", "tax_id")
REQUEST_KINDS = ("quote", "contract", "invoice")


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


def open_document_request(kind: str, fields: dict, now: datetime | None = None) -> dict:
    """报价、合同、发票只登记申请。不创建支付，不生成发票号。"""
    if kind not in REQUEST_KINDS:
        return {"status": "rejected", "payment_created": False, "invoice_number": None, "approved": False, "sent": False}
    base = open_procurement(fields, now)
    base.update({
        "kind": kind,
        "payment_created": False,
        "invoice_number": None,
        "todo": "待企业微信审批后才可发出。这里不生成支付。",
    })
    return base
