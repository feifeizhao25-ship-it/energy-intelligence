"""
FastAPI 应用入口（恢复重建版）。

原恢复碎片引用了约 30 个已丢失的模块（middleware/redis_client/websocket/
大量 routers)。本版本只挂载仓库中真实存在且可导入的路由，红线测试
（tests/test_redlines.py）的契约为准。
"""

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
    """健康检查。设置 SKILLS_MIN_COUNT 时，已加载技能数不足则返回 503（部署自检/回滚用）。"""
    import os

    body = {
        "status": "ok",
        "version": app.version,
        "environment": getattr(settings, "ENVIRONMENT", "development"),
    }
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
from app.api.v1 import billing as v1_billing  # noqa: E402
from app.api.v1 import auth as v1_auth  # noqa: E402
from app.api.v1 import finance as v1_finance  # noqa: E402
from app.api.v1 import operations as v1_operations  # noqa: E402
from app.api.v1 import research as v1_research  # noqa: E402
from app.api.v1 import resource as v1_resource  # noqa: E402
from app.api.v1 import users as v1_users  # noqa: E402
from app.api.v1 import privacy as v1_privacy  # noqa: E402
from app.routers import misc, personalization, projects  # noqa: E402
from app.routers import entitlements as entitlements_router  # noqa: E402
from app.routers import skills_executor  # noqa: E402

app.include_router(v1_auth.router, prefix="/api/v1", tags=["auth"])
app.include_router(v1_users.router, prefix="/api/v1", tags=["users"])
app.include_router(v1_resource.router, prefix="/api/v1", tags=["resource"])
app.include_router(v1_research.router, prefix="/api/v1", tags=["research"])
app.include_router(v1_ai.router, prefix="/api/v1", tags=["ai"])
app.include_router(v1_privacy.router, prefix="/api/v1", tags=["privacy"])
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
