"""阿里云短信。缺少密钥时返回未配置；只有开发环境可以走不发短信的例外。"""

from __future__ import annotations

import base64
import hashlib
import hmac
import os
import uuid
from datetime import datetime, timezone
from urllib.parse import quote

from app.config import settings


def _environment() -> str:
    return os.environ.get("ENVIRONMENT") or settings.ENVIRONMENT or "development"


def sms_settings() -> dict:
    return {
        "access_key_id": os.environ.get("ALIYUN_SMS_ACCESS_KEY_ID", "").strip(),
        "access_key_secret": os.environ.get("ALIYUN_SMS_ACCESS_KEY_SECRET", "").strip(),
        "sign_name": os.environ.get("ALIYUN_SMS_SIGN_NAME", "").strip(),
        "template_code": os.environ.get("ALIYUN_SMS_TEMPLATE_CODE", "").strip(),
    }


def sms_mode() -> str:
    values = sms_settings()
    if all(values.values()):
        return "live"
    if _environment() == "development":
        return "mock"
    return "unconfigured"


def _percent(value: str) -> str:
    return quote(value, safe="-_.~")


def build_send_sms_params(phone: str, code: str, *, timestamp: str, nonce: str) -> dict[str, str]:
    values = sms_settings()
    params = {
        "AccessKeyId": values["access_key_id"],
        "Action": "SendSms",
        "Format": "JSON",
        "PhoneNumbers": phone,
        "RegionId": "cn-hangzhou",
        "SignName": values["sign_name"],
        "SignatureMethod": "HMAC-SHA1",
        "SignatureNonce": nonce,
        "SignatureVersion": "1.0",
        "TemplateCode": values["template_code"],
        "TemplateParam": '{"code":"%s"}' % code,
        "Timestamp": timestamp,
        "Version": "2017-05-25",
    }
    canonical = "&".join(f"{_percent(key)}={_percent(params[key])}" for key in sorted(params))
    string_to_sign = "POST&%2F&" + _percent(canonical)
    digest = hmac.new((values["access_key_secret"] + "&").encode(), string_to_sign.encode(), hashlib.sha1).digest()
    params["Signature"] = base64.b64encode(digest).decode()
    return params


async def deliver_sms(phone: str, code: str, transport=None) -> dict:
    mode = sms_mode()
    if mode == "unconfigured":
        return {"ok": False, "code": "SMS_NOT_CONFIGURED"}
    if mode == "mock":
        revealed = os.environ.get("SMS_DEV_REVEAL") == "1"
        return {"ok": True, "mode": "development", **({"dev_code": code} if revealed else {})}
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    params = build_send_sms_params(phone, code, timestamp=timestamp, nonce=uuid.uuid4().hex)
    if transport is None:
        import httpx

        async def transport(url, body):  # noqa: A001
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.post(url, data=body)
                return response.status_code, response.text

    status, _text = await transport("https://dysmsapi.aliyuncs.com/", params)
    if status >= 300:
        return {"ok": False, "code": "SMS_SEND_FAILED"}
    return {"ok": True, "mode": "live"}
