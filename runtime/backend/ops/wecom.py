"""企业微信自建应用回调：签名、AES、审批回查。

超时和接口失败都不是批准。真正的 applyevent / getapprovaldetail 在密钥或
模板号缺失时保持桩，不发出请求。
"""
from __future__ import annotations

import base64
import hashlib
import os
import struct
from xml.sax.saxutils import escape

from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

BLOCK = 32

# TODO: 六个模板 ID 以企业微信管理后台当前模板为准。
TEMPLATES = {
    "content": os.environ.get("WECOM_TPL_CONTENT", ""),
    "business": os.environ.get("WECOM_TPL_BUSINESS", ""),
    "compliance": os.environ.get("WECOM_TPL_COMPLIANCE", ""),
    "promotion": os.environ.get("WECOM_TPL_PROMOTION", ""),
    "switch": os.environ.get("WECOM_TPL_SWITCH", ""),
    "incident": os.environ.get("WECOM_TPL_INCIDENT", ""),
}


def signature(token: str, timestamp: str, nonce: str, encrypt: str) -> str:
    parts = sorted([token, timestamp, nonce, encrypt])
    return hashlib.sha1("".join(parts).encode()).hexdigest()


def _pad(data: bytes) -> bytes:
    pad = BLOCK - (len(data) % BLOCK)
    if pad == 0:
        pad = BLOCK
    return data + bytes([pad]) * pad


def _unpad(data: bytes) -> bytes:
    pad = data[-1]
    if pad < 1 or pad > BLOCK:
        raise ValueError("bad pkcs7")
    return data[:-pad]


def _key_iv(aes_key: str) -> tuple[bytes, bytes]:
    key = base64.b64decode(aes_key + "=")
    if len(key) != 32:
        raise ValueError("EncodingAESKey must decode to 32 bytes")
    return key, key[:16]


def encrypt_message(aes_key: str, receive_id: str, message: str, random16: bytes | None = None) -> str:
    key, iv = _key_iv(aes_key)
    rand = random16 or os.urandom(16)
    raw = rand + struct.pack(">I", len(message.encode())) + message.encode() + receive_id.encode()
    cipher = Cipher(algorithms.AES(key), modes.CBC(iv))
    encryptor = cipher.encryptor()
    blob = encryptor.update(_pad(raw)) + encryptor.finalize()
    return base64.b64encode(blob).decode()


def decrypt_message(aes_key: str, encrypted: str, receive_id: str) -> str:
    key, iv = _key_iv(aes_key)
    cipher = Cipher(algorithms.AES(key), modes.CBC(iv))
    decryptor = cipher.decryptor()
    raw = _unpad(decryptor.update(base64.b64decode(encrypted)) + decryptor.finalize())
    msg_len = struct.unpack(">I", raw[16:20])[0]
    message = raw[20:20 + msg_len]
    tail = raw[20 + msg_len:].decode()
    if tail != receive_id:
        raise ValueError("receive_id mismatch")
    return message.decode()


def verify_callback(token: str, timestamp: str, nonce: str, encrypt: str, msg_signature: str) -> bool:
    return signature(token, timestamp, nonce, encrypt) == msg_signature


def approval_allows(detail: dict | None, content_sha256: str) -> bool:
    """getapprovaldetail 的结果。缺失、超时、非通过、摘要不一致，一律不允许。"""
    if not detail:
        return False
    if detail.get("error") or detail.get("status") != "approved":
        return False
    return detail.get("content_sha256") == content_sha256


def fetch_approval_detail(sp_no: str) -> dict:
    """TODO: GET https://qyapi.weixin.qq.com/cgi-bin/oa/getapprovaldetail。未配置时视为不可用。"""
    if not os.environ.get("NENGJIAN_WECOM_SECRET"):
        return {"error": "wecom_down", "status": "unavailable", "sp_no": sp_no}
    return {"error": "stub", "status": "unavailable", "sp_no": sp_no}


def submit_approval(template: str, content_sha256: str) -> dict:
    if not TEMPLATES.get(template):
        return {"submitted": False, "reason": "template id empty"}
    if not os.environ.get("NENGJIAN_WECOM_SECRET"):
        return {"submitted": False, "reason": "wecom_down"}
    # TODO: applyevent。桩不提交。
    return {"submitted": False, "reason": "stub", "content_sha256": content_sha256}


def callback_xml(token: str, aes_key: str, receive_id: str, message: str, timestamp: str, nonce: str) -> str:
    encrypted = encrypt_message(aes_key, receive_id, message)
    sig = signature(token, timestamp, nonce, encrypted)
    return (
        "<xml>"
        f"<Encrypt><![CDATA[{encrypted}]]></Encrypt>"
        f"<MsgSignature><![CDATA[{sig}]]></MsgSignature>"
        f"<TimeStamp>{escape(timestamp)}</TimeStamp>"
        f"<Nonce><![CDATA[{escape(nonce)}]]></Nonce>"
        "</xml>"
    )
