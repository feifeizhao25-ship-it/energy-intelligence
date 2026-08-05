"""
FastAPI 应用入口（恢复重建版）。

原恢复碎片引用了约 30 个已丢失的模块（middleware/redis_client/websocket/
大量 routers)。本版本只挂载仓库中真实存在且可导入的路由，红线测试
（tests/test_redlines.py）的契约为准。
"""

import ipaddress
import logging
from contextlib import asynccontextmanager
from typing import Any, Dict

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse
from sqlalchemy import text

from app.config import settings
from app.database import AsyncSessionLocal, close_db, init_db
from app.middleware import RateLimitMiddleware, SecurityHeadersMiddleware
from app.redis_client import redis_client

logger = logging.getLogger(__name__)

_SENSITIVE_KEY_FRAGMENTS = ("password", "token", "api_key", "apikey", "secret")


def _scrub_sensitive(value: Any) -> Any:
    """递归清洗事件字典中的敏感字段（password/token/api_key/secret）。"""
    if isinstance(value, dict):
        scrubbed: Dict[Any, Any] = {}
        for key, item in value.items():
            if isinstance(key, str) and any(
                fragment in key.lower() for fragment in _SENSITIVE_KEY_FRAGMENTS
            ):
                scrubbed[key] = "[Filtered]"
            else:
                scrubbed[key] = _scrub_sensitive(item)
        return scrubbed
    if isinstance(value, list):
        return [_scrub_sensitive(item) for item in value]
    return value


def _init_sentry() -> None:
    """Sentry 为可选依赖：配置了 SENTRY_DSN 且安装了 sentry_sdk 才启用。"""
    dsn = getattr(settings, "SENTRY_DSN", None)
    if not dsn:
        return
    try:
        import sentry_sdk
    except ImportError:
        logger.warning("SENTRY_DSN 已配置但 sentry_sdk 未安装，跳过 Sentry 初始化")
        return

    def before_send(event, hint):
        return _scrub_sensitive(event)

    sentry_sdk.init(
        dsn=dsn,
        environment=getattr(settings, "ENVIRONMENT", "development"),
        before_send=before_send,
        send_default_pii=False,
    )
    logger.info("Sentry 已启用")


_init_sentry()


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await init_db()
    except Exception as exc:  # 数据库未就绪时不阻断进程启动（健康检查仍可用）
        logger.warning("init_db 失败（数据库未就绪？）: %s", exc)
    yield
    try:
        await close_db()
    except Exception:
        pass


app = FastAPI(
    title="Energy Intelligence API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# Starlette 中间件按添加顺序逆序执行：限流在最外层先跑，安全头最后写响应。
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RateLimitMiddleware)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """R18 红线：参数校验错误必须带用户可读 message。"""
    safe_errors = []
    for err in exc.errors():
        err = dict(err)
        ctx = err.get("ctx")
        if ctx:
            err["ctx"] = {k: str(v) for k, v in ctx.items()}
        safe_errors.append(err)
    return JSONResponse(
        status_code=422,
        content={
            "code": 422,
            "message": "请求参数无效",
            "error": {"details": safe_errors},
        },
    )


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "version": app.version,
        "environment": getattr(settings, "ENVIRONMENT", "development"),
    }


@app.get("/ready")
async def ready():
    """就绪探针：DB（SELECT 1）与 Redis（ping）任一失败返回 503 及明细。"""
    checks = {}

    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception as exc:
        logger.warning("readiness: database check failed: %s", exc)
        checks["database"] = "error: {}".format(exc)

    try:
        pong = await redis_client.ping()
        checks["redis"] = "ok" if pong else "error: ping returned {!r}".format(pong)
    except Exception as exc:
        logger.warning("readiness: redis check failed: %s", exc)
        checks["redis"] = "error: {}".format(exc)

    healthy = all(value == "ok" for value in checks.values())
    if not healthy:
        return JSONResponse(
            status_code=503,
            content={"status": "not_ready", "checks": checks},
        )
    return {"status": "ready", "checks": checks}


def _is_internal_ip(host: str) -> bool:
    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        return False
    return ip.is_loopback or ip.is_private


@app.get("/metrics", response_class=PlainTextResponse)
async def metrics(request: Request):
    """Prometheus 抓取端点 — 仅内网可访问，对外返回 404。"""
    host = request.client.host if request.client else ""
    if not _is_internal_ip(host):
        return JSONResponse(status_code=404, content={"detail": "Not Found"})
    lines = [
        "# HELP energy_app_info Application build info",
        "# TYPE energy_app_info gauge",
        'energy_app_info{{version="{}"}} 1'.format(app.version),
        "# HELP energy_up Service up gauge",
        "# TYPE energy_up gauge",
        "energy_up 1",
        "",
    ]
    return PlainTextResponse("\n".join(lines))


# ── 路由挂载（仅挂载仓库中真实存在的模块）──────────────────────────────────────
from app.api.v1 import ai_assistant as v1_ai  # noqa: E402
from app.api.v1 import alerts as v1_alerts  # noqa: E402
from app.api.v1 import analytics as v1_analytics  # noqa: E402
from app.api.v1 import auth as v1_auth  # noqa: E402
from app.api.v1 import billing as v1_billing  # noqa: E402
from app.api.v1 import finance as v1_finance  # noqa: E402
from app.api.v1 import market as v1_market  # noqa: E402
from app.api.v1 import policies as v1_policies  # noqa: E402
from app.api.v1 import privacy as v1_privacy  # noqa: E402
from app.api.v1 import research as v1_research  # noqa: E402
from app.api.v1 import resource as v1_resource  # noqa: E402
from app.api.v1 import users as v1_users  # noqa: E402
from app.core.subscription import QuotaExceeded  # noqa: E402
from app.routers import misc, personalization, projects  # noqa: E402


@app.exception_handler(QuotaExceeded)
async def quota_exceeded_handler(request: Request, exc: QuotaExceeded):
    """配额/权益不足统一映射 429。"""
    return JSONResponse(
        status_code=429,
        content={
            "code": 429,
            "message": "配额或权益不足，请升级套餐或稍后重试",
            "error": {
                "quota_type": exc.quota_type,
                "limit": exc.limit,
                "current_count": exc.current_count,
            },
        },
    )


app.include_router(v1_auth.router, prefix="/api/v1", tags=["auth"])
app.include_router(v1_users.router, prefix="/api/v1", tags=["users"])
app.include_router(v1_resource.router, prefix="/api/v1", tags=["resource"])
app.include_router(v1_research.router, prefix="/api/v1", tags=["research"])
app.include_router(v1_ai.router, prefix="/api/v1", tags=["ai"])
app.include_router(v1_finance.router, prefix="/api/v1", tags=["finance"])
app.include_router(v1_privacy.router, prefix="/api/v1", tags=["privacy"])
app.include_router(v1_policies.router, prefix="/api/v1", tags=["policies"])
app.include_router(v1_market.router, prefix="/api/v1", tags=["market"])
app.include_router(v1_alerts.router, prefix="/api/v1", tags=["alerts"])
app.include_router(v1_analytics.router, prefix="/api/v1", tags=["analytics"])
app.include_router(v1_billing.router, prefix="/api/v1", tags=["billing"])
app.include_router(projects.router, prefix="/api/v1", tags=["projects"])
app.include_router(misc.router, prefix="/api/v1", tags=["misc"])
app.include_router(personalization.router, prefix="/api/v1", tags=["personalization"])

try:  # 定制报告申请，独立防护：导入失败不影响核心 API
    from app.routers import custom_reports as custom_reports_router

    app.include_router(
        custom_reports_router.router, prefix="/api/v1", tags=["custom-reports"]
    )
except Exception as exc:  # pragma: no cover
    logger.warning("custom_reports 路由未挂载: %s", exc)

try:  # 报告中心路由较大，独立防护：导入失败不影响核心 API
    from app.routers import reports as reports_router

    app.include_router(reports_router.router, prefix="/api/v1", tags=["reports"])
except Exception as exc:  # pragma: no cover
    logger.warning("reports 路由未挂载: %s", exc)

try:  # 故事板为演示渲染端点，独立防护
    from app.routers import storyboard as storyboard_router

    app.include_router(storyboard_router.router, tags=["storyboard"])
except Exception as exc:  # pragma: no cover
    logger.warning("storyboard 路由未挂载: %s", exc)
