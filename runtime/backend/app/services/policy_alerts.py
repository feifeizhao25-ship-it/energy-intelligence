"""政策发布后的提醒。邮件和企微都是选入后才发，并且按用户限速。

事件日志放在共享卷。没有通道配置时只记录，不外呼。
"""
from __future__ import annotations

import json
import os
import smtplib
from datetime import datetime, timezone
from email.message import EmailMessage
from pathlib import Path

RATE_LIMIT = 5
WINDOW_SECONDS = 3600


def _log_path() -> Path:
    raw = os.environ.get("NENGJIAN_POLICY_ALERT_LOG", "").strip()
    return Path(raw or "/var/lib/nengjian/policy-alerts.jsonl")


def _recent(user_id: str, now: datetime) -> int:
    path = _log_path()
    if not path.is_file():
        return 0
    count = 0
    for line in path.read_text(encoding="utf-8").splitlines():
        try:
            row = json.loads(line)
        except json.JSONDecodeError:
            continue
        if row.get("user_id") != user_id or not row.get("sent"):
            continue
        try:
            at = datetime.fromisoformat(row["at"])
        except (TypeError, ValueError):
            continue
        if (now - at).total_seconds() <= WINDOW_SECONDS:
            count += 1
    return count


def note_published(source_id: str, content_sha256: str, body: str = "") -> dict:
    path = _log_path()
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
    except OSError:
        path = Path("/tmp/nengjian-policy-alerts.jsonl")
        path.parent.mkdir(parents=True, exist_ok=True)
    row = {
        "source_id": source_id,
        "content_sha256": content_sha256,
        "at": datetime.now(timezone.utc).isoformat(),
        "body_stored": False,
    }
    del body
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(row, ensure_ascii=False) + "\n")
    return {"recorded": True}


def deliver_alert(user_id: str, title: str, description: str, *, email: bool = False, wecom: bool = False, address: str = "", wecom_user: str = "", now: datetime | None = None, email_transport=None, wecom_transport=None) -> dict:
    """选入的通道才发送。同一用户一小时最多 5 条。"""
    moment = now or datetime.now(timezone.utc)
    if not email and not wecom:
        return {"sent": False, "reason": "opt-in missing"}
    if _recent(user_id, moment) >= RATE_LIMIT:
        return {"sent": False, "reason": "rate_limited", "limit": RATE_LIMIT}
    result = {"sent": False, "email": "skipped", "wecom": "skipped"}
    if email:
        result["email"] = _send_email(address, title, description, email_transport)
    if wecom:
        result["wecom"] = _send_wecom(wecom_user, title, description, wecom_transport)
    result["sent"] = result["email"] == "sent" or result["wecom"] == "sent"
    path = _log_path()
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
    except OSError:
        path = Path("/tmp/nengjian-policy-alerts.jsonl")
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps({
            "user_id": user_id,
            "at": moment.isoformat(),
            "sent": result["sent"],
            "title": title[:80],
            "body_stored": False,
        }, ensure_ascii=False) + "\n")
    return result


def _send_email(address: str, title: str, description: str, transport) -> str:
    host = os.environ.get("SMTP_HOST", "").strip()
    if transport is None and not host:
        return "unconfigured"
    if not address:
        return "missing_address"
    if transport is not None:
        transport(address, title, description)
        return "sent"
    sender = os.environ.get("SMTP_FROM", "").strip() or "noreply@localhost"
    message = EmailMessage()
    message["From"] = sender
    message["To"] = address
    message["Subject"] = title[:80]
    message.set_content(description[:500])
    port = int(os.environ.get("SMTP_PORT", "587") or "587")
    user = os.environ.get("SMTP_USER", "").strip()
    password = os.environ.get("SMTP_PASSWORD", "")
    try:
        with smtplib.SMTP(host, port, timeout=10) as client:
            if user:
                client.starttls()
                client.login(user, password)
            client.send_message(message)
    except Exception:
        return "failed"
    return "sent"


def _subscriber_rows() -> list[dict]:
    raw = os.environ.get("NENGJIAN_POLICY_SUBSCRIBERS", "").strip()
    if not raw:
        return []
    path = Path(raw)
    text = path.read_text(encoding="utf-8") if path.is_file() else raw
    data = json.loads(text)
    return list(data if isinstance(data, list) else data.get("subscribers") or [])


def notify_published(source_id: str, content_sha256: str, subscribers: list[dict] | None = None, email_transport=None, wecom_transport=None) -> list[dict]:
    """审批发布之后，只给选入了邮件或企微的订阅者发提醒。没有订阅名单就不外发。"""
    people = _subscriber_rows() if subscribers is None else subscribers
    title = f"政策快照已发布 {source_id}"[:80]
    description = f"摘要 {content_sha256[:16]}。通知不含正文。"
    sent = []
    for person in people:
        email_on = bool(person.get("channel_email") if "channel_email" in person else person.get("channelEmail"))
        wecom_on = bool(person.get("channel_wecom") if "channel_wecom" in person else person.get("channelWecom"))
        address = str(person.get("address") or person.get("email") or "")
        wecom_user = str(person.get("wecom_user") or person.get("wecomUser") or "")
        user_id = str(person.get("user_id") or person.get("userId") or "")
        if not user_id or not (email_on or wecom_on):
            continue
        sent.append(deliver_alert(
            user_id, title, description,
            email=email_on, wecom=wecom_on, address=address, wecom_user=wecom_user,
            email_transport=email_transport, wecom_transport=wecom_transport,
        ))
    return sent


def _send_wecom(user_id: str, title: str, description: str, transport) -> str:
    if not user_id:
        return "missing_user"
    from ops.wecom import send_template_card
    sent = send_template_card(user_id, title, description, transport=transport)
    if sent.get("sent"):
        return "sent"
    return sent.get("reason") or "failed"
