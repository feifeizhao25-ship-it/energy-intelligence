"""运维中间件：API 限流与安全响应头。

限流基于 redis_client（生产为真实 Redis，测试/未配置时为进程内实现），
采用滑动窗口计数（当前窗口计数 + 上一窗口按时间衰减加权），
只依赖 get/incr/expire 三个命令，两种后端语义一致。
"""

from __future__ import annotations

import logging
import json
import re
import time
from typing import Optional

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from app.config import settings
from app.redis_client import redis_client

logger = logging.getLogger(__name__)

# 存活探针与监控端点不参与限流
RATE_LIMIT_EXEMPT_PATHS = frozenset({"/health", "/ready", "/metrics"})
_CJK_RE = re.compile(r"[\u3400-\u9fff]")


def _sanitize_global_payload(value):
    """Fail closed when CN content reaches a Global JSON response.

    Translation belongs at the source. This last-resort boundary prevents mixed-
    market content from leaking while retaining a machine-readable indication.
    """
    if isinstance(value, str):
        return "Content is unavailable for the Global market." if _CJK_RE.search(value) else value
    if isinstance(value, list):
        return [_sanitize_global_payload(item) for item in value]
    if isinstance(value, dict):
        return {
            (key if not isinstance(key, str) or not _CJK_RE.search(key) else "localized_field"):
            _sanitize_global_payload(item)
            for key, item in value.items()
        }
    return value


class GlobalLanguageBoundaryMiddleware(BaseHTTPMiddleware):
    """Guarantee that Global JSON API responses contain no CJK text."""

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        if getattr(settings, "MARKET_REGION", "cn") != "global":
            return response
        content_type = response.headers.get("content-type", "").lower()
        if "application/json" not in content_type:
            return response

        raw = b"".join([chunk async for chunk in response.body_iterator])
        try:
            payload = json.loads(raw)
        except (json.JSONDecodeError, UnicodeDecodeError):
            logger.error("Global JSON response could not be decoded; failing closed")
            return JSONResponse(
                status_code=500,
                content={"code": 500, "message": "Invalid API response"},
            )
        sanitized = _sanitize_global_payload(payload)
        headers = dict(response.headers)
        headers.pop("content-length", None)
        return JSONResponse(
            status_code=response.status_code,
            content=sanitized,
            headers=headers,
            background=response.background,
        )


def _client_ip(request: Request) -> str:
    """优先取反向代理透传的首个 X-Forwarded-For，否则用直连地址。"""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        first = forwarded.split(",")[0].strip()
        if first:
            return first
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


class RateLimitMiddleware(BaseHTTPMiddleware):
    """每 IP 滑动窗口限流：默认 100 次/分钟，超限返回 429 + Retry-After。

    Redis 不可用时不阻断请求（记录告警），避免限流组件自身成为单点故障。
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        if request.url.path in RATE_LIMIT_EXEMPT_PATHS:
            return await call_next(request)

        limit = int(getattr(settings, "RATE_LIMIT_REQUESTS", 100))
        window = int(getattr(settings, "RATE_LIMIT_WINDOW", 60))
        if limit <= 0 or window <= 0:
            return await call_next(request)

        ip = _client_ip(request)
        now = time.time()
        bucket = int(now // window)
        current_key = "ratelimit:{}:{}".format(ip, bucket)
        previous_key = "ratelimit:{}:{}".format(ip, bucket - 1)

        try:
            count = await redis_client.incr(current_key)
            if count == 1:
                # 保留两个窗口周期，供下一窗口做衰减加权
                await redis_client.expire(current_key, window * 2)
            previous_raw: Optional[str] = await redis_client.get(previous_key)
            previous = int(previous_raw) if previous_raw else 0
        except Exception as exc:  # pragma: no cover - Redis 故障兜底
            logger.warning("限流计数失败（放行请求）: %s", exc)
            return await call_next(request)

        elapsed_ratio = (now - bucket * window) / window
        estimated = count + previous * (1.0 - elapsed_ratio)
        if estimated > limit:
            retry_after = max(1, int(window - (now - bucket * window)))
            global_market = getattr(settings, "MARKET_REGION", "cn") == "global"
            return JSONResponse(
                status_code=429,
                content={
                    "code": 429,
                    "message": (
                        "Too many requests. Please try again later."
                        if global_market
                        else "请求过于频繁，请稍后重试"
                    ),
                    "error": {"limit": limit, "window_seconds": window},
                },
                headers={"Retry-After": str(retry_after)},
            )
        return await call_next(request)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """统一附加安全响应头；生产环境额外开启 HSTS。"""

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault(
            "Referrer-Policy", "strict-origin-when-cross-origin"
        )
        if getattr(settings, "ENVIRONMENT", "development") == "production":
            response.headers.setdefault(
                "Strict-Transport-Security",
                "max-age=31536000; includeSubDomains",
            )
        return response
