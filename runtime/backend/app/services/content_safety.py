"""阿里云内容安全。endpoint 为空时不发请求。"""
from __future__ import annotations

from app.config import settings


def review_text(text: str) -> dict:
    if not settings.NENGJIAN_GUARDRAIL_ENDPOINT or not settings.NENGJIAN_GUARDRAIL_AK_ID:
        return {"status": "disabled", "provider": "aliyun-content-security", "checked": False}
    # TODO: 按当前内容安全 OpenAPI 签名并 POST。密钥缺失或 endpoint 未填时不要访问境外服务。
    return {"status": "stub", "provider": "aliyun-content-safety", "checked": False, "chars": len(text or "")}
