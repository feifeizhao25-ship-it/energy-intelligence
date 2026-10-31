"""
FastAPI 应用入口（恢复重建版）。

原恢复碎片引用了约 30 个已丢失的模块（middleware/redis_client/websocket/
大量 routers)。本版本只挂载仓库中真实存在且可导入的路由，红线测试
（tests/test_redlines.py）的契约为准。
"""

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.database import close_db, init_db

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await init_db()
    except Exception as exc:  # 数据库未就绪时不阻断进程启动（健康检查仍可用）
        logger.warning("init_db 失败（数据库未就绪？）: %s", exc)
    try:
        yield
    finally:
        # Close on the application's event loop, before the server closes it.
        # A Redis shutdown failure must not prevent database cleanup.
        from app.redis_client import redis_client

        try:
            close = getattr(redis_client, "aclose", None) or redis_client.close
            await close()
        except Exception:
            logger.warning("Redis 连接关闭失败", exc_info=True)
        finally:
            try:
                await close_db()
            except Exception:
                logger.warning("数据库连接关闭失败", exc_info=True)


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


async def _probe_database() -> str:
    try:
        from sqlalchemy import text
        from app.database import engine

        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return "ok"
    except Exception:
        logger.warning("健康检查无法连接数据库", exc_info=True)
        return "unavailable"


async def _probe_redis() -> str:
    try:
        from app.redis_client import _MemoryRedis, redis_client

        if isinstance(redis_client, _MemoryRedis):
            return "memory" if settings.ENVIRONMENT != "production" else "unavailable"
        pong = await asyncio.wait_for(redis_client.ping(), timeout=1)
        if pong in (True, "PONG", b"PONG"):
            return "ok"
        return "unavailable"
    except Exception:
        logger.warning("健康检查无法连接 Redis", exc_info=True)
        return "unavailable"


@app.get("/health")
async def health():
    """健康检查。生产环境必须同时连上数据库和 Redis；技能数量不足时也返回 503。"""
    import os

    body = {
        "status": "ok",
        "version": app.version,
        "environment": getattr(settings, "ENVIRONMENT", "development"),
        "database": await _probe_database(),
        "redis": await _probe_redis(),
    }
    if body["database"] != "ok" or (settings.ENVIRONMENT == "production" and body["redis"] != "ok"):
        body["status"] = "degraded"
        body["detail"] = "数据库或 Redis 不可用"
        return JSONResponse(status_code=503, content=body)
    min_skills = os.getenv("SKILLS_MIN_COUNT", "").strip()
    if min_skills.isdigit():
        from app.skills.registry import get_registry

        loaded = get_registry().discover_all()
        body["skills_loaded"] = loaded
        if loaded < int(min_skills):
            body["status"] = "degraded"
            body["detail"] = f"skills loaded {loaded} < required {min_skills}"
            return JSONResponse(status_code=503, content=body)
    return body


# ── 路由挂载（仅挂载仓库中真实存在的模块）──────────────────────────────────────
from app.api.v1 import ai_assistant as v1_ai  # noqa: E402
from app.api.v1.domestic_product import router as domestic_product_router  # noqa: E402
from app.api.v1.wecom_callback import router as wecom_callback_router  # noqa: E402
from app.api.v1 import billing as v1_billing  # noqa: E402
from app.api.v1 import auth as v1_auth  # noqa: E402
from app.api.v1 import finance as v1_finance  # noqa: E402
from app.api.v1 import operations as v1_operations  # noqa: E402
from app.api.v1 import research as v1_research  # noqa: E402
from app.api.v1 import resource as v1_resource  # noqa: E402
from app.api.v1 import users as v1_users  # noqa: E402
from app.api.v1 import privacy as v1_privacy  # noqa: E402
from app.api.v1 import status as v1_status  # noqa: E402
from app.api.v1 import workbench as v1_workbench  # noqa: E402
from app.routers import misc, personalization, projects  # noqa: E402
from app.routers import entitlements as entitlements_router  # noqa: E402
from app.routers import skills_executor  # noqa: E402

app.include_router(v1_auth.router, prefix="/api/v1", tags=["auth"])
app.include_router(v1_users.router, prefix="/api/v1", tags=["users"])
app.include_router(v1_resource.router, prefix="/api/v1", tags=["resource"])
app.include_router(v1_research.router, prefix="/api/v1", tags=["research"])
app.include_router(v1_ai.router, prefix="/api/v1", tags=["ai"])
app.include_router(domestic_product_router, prefix="/api/v1", tags=["domestic"])
app.include_router(wecom_callback_router, prefix="/api/v1", tags=["wecom"])
app.include_router(v1_privacy.router, prefix="/api/v1", tags=["privacy"])
app.include_router(v1_status.router, prefix="/api/v1", tags=["status"])
app.include_router(v1_workbench.router, prefix="/api/v1", tags=["workbench"])
app.include_router(v1_billing.router, prefix="/api/v1", tags=["billing"])
app.include_router(v1_finance.router, prefix="/api/v1", tags=["finance"])
app.include_router(v1_operations.router, prefix="/api/v1", tags=["operations"])
app.include_router(projects.router, prefix="/api/v1", tags=["projects"])
app.include_router(misc.router, prefix="/api/v1", tags=["misc"])
app.include_router(skills_executor.router, prefix="/api/v1")
# 权益注册表对定价/支付/客服页公开，路径按契约为 /api/entitlements（不带 v1）
app.include_router(entitlements_router.router, prefix="/api", tags=["entitlements"])
app.include_router(
    personalization.router,
    prefix="/api/v1",
    tags=["personalization-demo"],
)

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
