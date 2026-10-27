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

# 八个模板 ID 以企业微信管理后台当前模板为准。控件 ID 也来自后台，用 WECOM_SHA_CONTROL_ID 覆盖。
TEMPLATES = {
    "content": os.environ.get("WECOM_TPL_CONTENT", ""),
    "business": os.environ.get("WECOM_TPL_BUSINESS", ""),
    "compliance": os.environ.get("WECOM_TPL_COMPLIANCE", ""),
    "promotion": os.environ.get("WECOM_TPL_PROMOTION", ""),
    "switch": os.environ.get("WECOM_TPL_SWITCH", ""),
    "incident": os.environ.get("WECOM_TPL_INCIDENT", ""),
    "policy": os.environ.get("WECOM_TPL_POLICY", ""),
    "finance": os.environ.get("WECOM_TPL_FINANCE", ""),
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


def _creds() -> dict:
    return {
        "secret": os.environ.get("NENGJIAN_WECOM_SECRET", ""),
        "corp": os.environ.get("NENGJIAN_WECOM_CORP_ID", ""),
        "agent": os.environ.get("NENGJIAN_WECOM_AGENT_ID", ""),
    }


def _http_json(method: str, url: str, payload: dict | None = None) -> dict:
    import json
    import urllib.request
    data = None if payload is None else json.dumps(payload).encode()
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"}, method=method)
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode() or "{}")


def _access_token(getter=None) -> str:
    creds = _creds()
    url = f"https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid={creds['corp']}&corpsecret={creds['secret']}"
    data = (getter or (lambda u: _http_json("GET", u)))(url)
    token = (data or {}).get("access_token") or ""
    if not token:
        raise RuntimeError("wecom token missing")
    return token


def _sha_from_detail(info: dict) -> str:
    import re
    blob = json_dumps(info)
    found = re.findall(r"[a-f0-9]{64}", blob)
    return found[0] if found else ""


def json_dumps(value) -> str:
    import json
    return json.dumps(value, ensure_ascii=False)


def fetch_approval_detail(sp_no: str, transport=None) -> dict:
    """POST https://qyapi.weixin.qq.com/cgi-bin/oa/getapprovaldetail 。未配置时视为不可用。"""
    creds = _creds()
    if not creds["secret"]:
        return {"error": "wecom_down", "status": "unavailable", "sp_no": sp_no}
    if not creds["corp"] or not creds["agent"] or not sp_no:
        return {"error": "missing_corp_or_agent", "status": "unavailable", "sp_no": sp_no}
    try:
        if transport is None:
            token = _access_token()
            data = _http_json("POST", f"https://qyapi.weixin.qq.com/cgi-bin/oa/getapprovaldetail?access_token={token}", {"sp_no": sp_no})
        else:
            data = transport("getapprovaldetail", {"sp_no": sp_no, "agentid": creds["agent"]})
    except Exception as exc:
        return {"error": exc.__class__.__name__, "status": "unavailable", "sp_no": sp_no}
    info = (data or {}).get("info") or {}
    sp_status = info.get("sp_status")
    status = "approved" if sp_status == 2 else "unavailable"
    if (data or {}).get("errcode") not in (0, None) and not info:
        return {"error": "wecom_down", "status": "unavailable", "sp_no": sp_no}
    return {
        "status": status,
        "sp_no": sp_no,
        "sp_status": sp_status,
        "content_sha256": _sha_from_detail(info),
        "agent_id": creds["agent"],
    }


def submit_approval(template: str, content_sha256: str, transport=None) -> dict:
    if template not in TEMPLATES:
        return {"submitted": False, "reason": "unknown template"}
    if not TEMPLATES.get(template):
        return {"submitted": False, "reason": "template id empty"}
    creds = _creds()
    if not creds["secret"]:
        return {"submitted": False, "reason": "wecom_down"}
    if not creds["corp"] or not creds["agent"]:
        return {"submitted": False, "reason": "missing_corp_or_agent"}
    creator = os.environ.get("NENGJIAN_WECOM_CREATOR", "")
    if not creator:
        return {"submitted": False, "reason": "creator_missing", "content_sha256": content_sha256}
    control_id = os.environ.get("WECOM_SHA_CONTROL_ID", "Text-sha256")
    payload = {
        "creator_userid": creator,
        "template_id": TEMPLATES[template],
        "use_template_approver": 1,
        "agentid": int(creds["agent"]) if str(creds["agent"]).isdigit() else creds["agent"],
        "apply_data": {"contents": [{"control": "Text", "id": control_id, "value": {"text": content_sha256}}]},
        "summary_list": [{"summary_info": [{"text": content_sha256, "lang": "zh_CN"}]}],
    }
    try:
        if transport is None:
            token = _access_token()
            data = _http_json("POST", f"https://qyapi.weixin.qq.com/cgi-bin/oa/applyevent?access_token={token}", payload)
        else:
            data = transport("applyevent", payload)
    except Exception as exc:
        return {"submitted": False, "reason": exc.__class__.__name__, "content_sha256": content_sha256}
    if (data or {}).get("errcode") not in (0, None):
        return {"submitted": False, "reason": "wecom_rejected", "content_sha256": content_sha256}
    return {"submitted": True, "sp_no": (data or {}).get("sp_no"), "content_sha256": content_sha256}


def send_template_card(user_id: str, title: str, description: str, transport=None) -> dict:
    creds = _creds()
    if not all(creds.values()):
        return {"sent": False, "reason": "wecom_down"}
    payload = {
        "touser": user_id,
        "msgtype": "template_card",
        "agentid": int(creds["agent"]) if str(creds["agent"]).isdigit() else creds["agent"],
        "template_card": {
            "card_type": "text_notice",
            "main_title": {"title": title[:40]},
            "sub_title_text": description[:160],
            "card_action": {"type": 1, "url": "https://work.weixin.qq.com"},
        },
    }
    try:
        if transport is None:
            token = _access_token()
            data = _http_json("POST", f"https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token={token}", payload)
        else:
            data = transport("message/send", payload)
    except Exception as exc:
        return {"sent": False, "reason": exc.__class__.__name__}
    return {"sent": (data or {}).get("errcode") in (0, None), "result": data}


def send_group_robot(text: str, transport=None) -> dict:
    key = os.environ.get("NENGJIAN_WECOM_ROBOT_KEY", "")
    if not key:
        return {"sent": False, "reason": "robot key empty"}
    payload = {"msgtype": "text", "text": {"content": text[:2000]}}
    url = f"https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key={key}"
    try:
        data = transport("webhook", payload) if transport else _http_json("POST", url, payload)
    except Exception as exc:
        return {"sent": False, "reason": exc.__class__.__name__}
    return {"sent": (data or {}).get("errcode") in (0, None)}


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
