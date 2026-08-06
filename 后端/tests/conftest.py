"""
Pytest 共享 fixtures。

- 在导入任何 app 模块前，把 TEST_DATABASE_URL 映射到 DATABASE_URL
  （test_full_with_postgres.sh 会起临时 Postgres 并导出 TEST_DATABASE_URL；
  未设置时退回本地 SQLite 内存库，保证单测在任何机器上可跑）。
"""

import os
import uuid

# ── 必须先于 app 导入的环境准备 ───────────────────────────────────────────────
os.environ.setdefault(
    "DATABASE_URL",
    # 共享文件库：:memory: 会让每个连接拿到独立空库，无 fixture 的测试直接失败
    os.environ.get("TEST_DATABASE_URL", "sqlite+aiosqlite:////tmp/energy_pytest.db"),
)
os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("ENVIRONMENT", "test")
os.environ["ENERGY_TEST_MODE"] = "1"  # 见 app.database：测试使用 NullPool
# 全量用例共享同一测试 IP，默认 100 次/分钟会把正常用例限成 429；
# 测试环境默认放开限流，限流用例（test_ops_endpoints）自行调小窗口。
os.environ.setdefault("RATE_LIMIT_REQUESTS", "100000")

import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402

from app.core.security import create_access_token  # noqa: E402
from app.database import engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models.database import Base  # noqa: E402
from app.models.user import User  # noqa: E402
from app.utils.security import get_password_hash  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def _dispose_engine_at_session_end():
    """会话结束时释放引擎连接 — 否则 sqlite/pg 连接的底层线程会阻止解释器退出。"""
    yield
    import asyncio

    asyncio.run(engine.dispose())


@pytest_asyncio.fixture(scope="session", autouse=True)
async def _create_tables_at_session_start():
    """会话级建表：不依赖 fixture 的测试（如 test_auth 直连 ASGI）也需要表存在。"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


@pytest_asyncio.fixture
async def setup_database():
    """每个用例重建全部表，保证隔离； teardown 后保留空表供无 fixture 测试使用。"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)


@pytest_asyncio.fixture
async def db_session(setup_database):
    from app.database import AsyncSessionLocal

    async with AsyncSessionLocal() as session:
        yield session


@pytest_asyncio.fixture
async def client(setup_database):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture
async def auth_headers(db_session):
    user = User(
        id=str(uuid.uuid4()),
        phone=f"138{uuid.uuid4().hex[:8]}",
        password_hash=get_password_hash("TestPass123!"),
        name="测试用户",
        role="user",
        market="cn",
        subscription_plan="pro",
        usage_quota={"ai_calls": {}, "report_exports": {}},
    )
    db_session.add(user)
    await db_session.commit()
    token = create_access_token(str(user.id))
    return {"Authorization": f"Bearer {token}"}
