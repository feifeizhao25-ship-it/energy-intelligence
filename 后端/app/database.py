"""
Canonical async database module.

历史代码里同时存在 `app.core.database` 与 `app.models.database` 两套入口，
本模块是恢复后的统一门面：引擎、会话工厂、FastAPI 依赖、建表/关连接。
所有模型共享 `app.models.database.Base`，保证 init_db 一次建全表。
"""

from __future__ import annotations

import logging
import os
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.config import settings
from app.models.database import Base  # 所有模型共用的 declarative Base

logger = logging.getLogger(__name__)

# 测试环境每个用例一个事件循环（pytest-asyncio），池化连接会绑定到已关闭的
# 旧循环（asyncpg "Event loop is closed"），因此测试模式下使用 NullPool。
_engine_kwargs: dict = {
    "echo": settings.DEBUG,
    "pool_pre_ping": True,
}
if os.environ.get("ENERGY_TEST_MODE") == "1":
    _engine_kwargs["poolclass"] = NullPool
else:
    _engine_kwargs["pool_recycle"] = 3600

# ── Engine ────────────────────────────────────────────────────────────────────
engine = create_async_engine(settings.DATABASE_URL, **_engine_kwargs)

# ── Session factory ───────────────────────────────────────────────────────────
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


# ── FastAPI dependency ─────────────────────────────────────────────────────────
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


# ── Lifecycle ─────────────────────────────────────────────────────────────────
async def init_db() -> None:
    """Create all tables that do not exist yet."""
    # 确保所有模型模块已注册到 Base.metadata
    import app.models  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("database tables ensured")


async def close_db() -> None:
    await engine.dispose()
