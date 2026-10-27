"""阿里云内容安全 TextModerationPlus。

endpoint 或 AccessKey 为空时不发请求。签名为 ACS3 之前的 RPC HMAC-SHA1
（Action=TextModerationPlus, Version=2022-03-02）。Service 名称以控制台为准，
可用 NENGJIAN_GUARDRAIL_SERVICE 覆盖，默认 comment_detection_pro。
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import uuid
from datetime import datetime, timezone
from urllib.parse import quote

from app.config import settings


def _percent(value: str) -> str:
    return quote(str(value), safe="-_.~")


def _sign(params: dict, secret: str) -> str:
    canonical = "&".join(f"{_percent(k)}={_percent(params[k])}" for k in sorted(params))
    string_to_sign = "POST&%2F&" + _percent(canonical)
    digest = hmac.new((secret + "&").encode(), string_to_sign.encode(), hashlib.sha1).digest()
    return base64.b64encode(digest).decode()


def review_text(text: str, poster=None) -> dict:
    endpoint = (settings.NENGJIAN_GUARDRAIL_ENDPOINT or "").strip()
    ak = settings.NENGJIAN_GUARDRAIL_AK_ID or ""
    secret = settings.NENGJIAN_GUARDRAIL_AK_SECRET or ""
    if not endpoint or not ak or not secret:
        return {"status": "disabled", "provider": "aliyun-content-security", "checked": False}
    import os
    service = os.environ.get("NENGJIAN_GUARDRAIL_SERVICE", "comment_detection_pro")
    params = {
        "Action": "TextModerationPlus",
        "Version": "2022-03-02",
        "Format": "JSON",
        "AccessKeyId": ak,
        "SignatureMethod": "HMAC-SHA1",
        "SignatureVersion": "1.0",
        "SignatureNonce": uuid.uuid4().hex,
        "Timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "Service": service,
        "ServiceParameters": json.dumps({"content": text or ""}, ensure_ascii=False),
    }
    params["Signature"] = _sign(params, secret)
    body = "&".join(f"{_percent(k)}={_percent(v)}" for k, v in params.items())

    def _post(url: str, payload: str) -> dict:
        import urllib.request
        req = urllib.request.Request(url, data=payload.encode("utf-8"), headers={"Content-Type": "application/x-www-form-urlencoded"}, method="POST")
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode() or "{}")

    try:
        data = (poster or _post)(endpoint, body)
    except Exception as exc:
        return {"status": "error", "provider": "aliyun-content-security", "checked": False, "reason": exc.__class__.__name__}
    return {"status": "ok", "provider": "aliyun-content-security", "checked": True, "result": data}
