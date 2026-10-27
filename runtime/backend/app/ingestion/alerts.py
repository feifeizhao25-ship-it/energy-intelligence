"""抓取失败或结构偏离时走现有告警。邮箱和企微都没配置时不外发。"""

from __future__ import annotations

import os

from app.services.policy_alerts import deliver_alert


def channels_open() -> tuple[bool, bool]:
    wecom = bool(
        os.environ.get("NENGJIAN_WECOM_CORP_ID", "").strip()
        and os.environ.get("NENGJIAN_WECOM_SECRET", "").strip()
        and os.environ.get("NENGJIAN_WECOM_AGENT_ID", "").strip()
    )
    email = bool(os.environ.get("SMTP_HOST", "").strip() and os.environ.get("PUBLIC_INGEST_ALERT_EMAIL", "").strip())
    return email, wecom


def notify_problem(source_id: str, title: str, detail: str, wecom_transport=None) -> dict:
    email_on, wecom_on = channels_open()
    return deliver_alert(
        os.environ.get("PUBLIC_INGEST_ALERT_USER", "public-ingest"),
        title[:80],
        detail[:500],
        email=email_on,
        wecom=wecom_on,
        address=os.environ.get("PUBLIC_INGEST_ALERT_EMAIL", ""),
        wecom_user=os.environ.get("PUBLIC_INGEST_ALERT_WECOM_USER", ""),
        wecom_transport=wecom_transport,
    )
