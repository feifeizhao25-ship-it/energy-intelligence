"""企业微信审批回调。签名或解密失败时不发布。

批准只认 getapprovaldetail，并且摘要必须对上待审批快照。
标准库 ElementTree 不解析外部实体；带 DOCTYPE 的报文直接拒绝。
"""
from __future__ import annotations

import os
import sqlite3
from xml.etree import ElementTree as ET

from ops.wecom import decrypt_message, fetch_approval_detail, verify_callback

from app.services.policy_pipeline import connect, publish_matching_approval


def fetch_detail(sp_no: str) -> dict:
    return fetch_approval_detail(sp_no)


def _creds() -> tuple[str, str, str]:
    return (
        os.environ.get("NENGJIAN_WECOM_TOKEN", ""),
        os.environ.get("NENGJIAN_WECOM_AES_KEY", ""),
        os.environ.get("NENGJIAN_WECOM_CORP_ID", ""),
    )


def _reject_dangerous_xml(raw: bytes) -> bool:
    upper = raw.upper()
    return b"<!DOCTYPE" in upper or b"<!ENTITY" in upper


def _xml_root(raw: bytes) -> ET.Element:
    if _reject_dangerous_xml(raw):
        raise ValueError("回调报文无效")
    return ET.fromstring(raw)


def _sp_no(plain: str) -> str:
    if _reject_dangerous_xml(plain.encode("utf-8", errors="ignore")):
        raise ValueError("回调报文无效")
    root = ET.fromstring(plain)
    for tag in ("SpNo", "sp_no"):
        node = root.find(f".//{tag}")
        if node is not None and (node.text or "").strip():
            return node.text.strip()
    return ""


def _policy_conn() -> sqlite3.Connection:
    from pathlib import Path

    path = Path(os.environ.get("NENGJIAN_POLICY_DB", "/var/lib/nengjian/policy.sqlite"))
    path.parent.mkdir(parents=True, exist_ok=True)
    return connect(path)


def verify_echo(timestamp: str, nonce: str, echostr: str, msg_signature: str) -> str:
    token, aes_key, receive_id = _creds()
    if not token or not aes_key or not receive_id:
        raise RuntimeError("回调未配置")
    if not verify_callback(token, timestamp, nonce, echostr, msg_signature):
        raise PermissionError("签名校验未通过")
    return decrypt_message(aes_key, echostr, receive_id)


def receive_event(raw: bytes, timestamp: str, nonce: str, msg_signature: str, conn: sqlite3.Connection | None = None) -> dict:
    token, aes_key, receive_id = _creds()
    if not token or not aes_key or not receive_id:
        raise RuntimeError("回调未配置")
    if _reject_dangerous_xml(raw):
        raise ValueError("回调报文无效")
    root = _xml_root(raw)
    encrypt = (root.findtext("Encrypt") or "").strip()
    if not encrypt or not verify_callback(token, timestamp, nonce, encrypt, msg_signature):
        raise PermissionError("签名校验未通过")
    plain = decrypt_message(aes_key, encrypt, receive_id)
    sp_no = _sp_no(plain)
    detail = fetch_detail(sp_no) if sp_no else {"status": "unavailable"}
    own = conn is None
    if conn is None:
        conn = _policy_conn()
    try:
        result = publish_matching_approval(conn, detail, sp_no)
    finally:
        if own:
            conn.close()
    return {"ack": "success", "sp_no": sp_no, **result}
