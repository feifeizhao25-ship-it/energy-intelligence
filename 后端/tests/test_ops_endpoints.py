"""运维端点测试：/ready、限流、GDPR 隐私端点、安全响应头、daily-layout API。"""

import uuid

import pytest
from sqlalchemy import select

from app.core.security import create_access_token
from app.models.database import Project
from app.models.user import User
from app.models.report import Report
from app.utils.security import get_password_hash


@pytest.fixture
async def seeded_user(db_session):
    """带一个项目与一份报告的用户，返回 (user, headers)。"""
    user = User(
        id=str(uuid.uuid4()),
        phone=f"139{uuid.uuid4().hex[:8]}",
        password_hash=get_password_hash("TestPass123!"),
        name="隐私测试用户",
        role="user",
        market="cn",
        subscription_plan="pro",
        usage_quota={"ai_calls": {}, "report_exports": {}},
    )
    project = Project(
        id=str(uuid.uuid4()),
        user_id=user.id,
        name="隐私测试项目",
        technology="solar",
        status="draft",
    )
    report = Report(
        id=str(uuid.uuid4()),
        project_id=project.id,
        user_id=user.id,
        report_type="feasibility",
        title="隐私测试报告",
    )
    db_session.add_all([user, project, report])
    await db_session.commit()
    headers = {"Authorization": f"Bearer {create_access_token(str(user.id))}"}
    return user, headers


# ── /ready ─────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_ready_ok(client):
    resp = await client.get("/ready")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ready"
    assert body["checks"]["database"] == "ok"
    assert body["checks"]["redis"] == "ok"


@pytest.mark.asyncio
async def test_ready_db_down_returns_503(client, monkeypatch):
    """DB 断开时 /ready 返回 503 及明细，redis 检查不受影响。"""
    import app.main as main_module

    class _BrokenSession:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        async def execute(self, *args, **kwargs):
            raise RuntimeError("database is down")

    monkeypatch.setattr(main_module, "AsyncSessionLocal", lambda: _BrokenSession())

    resp = await client.get("/ready")
    assert resp.status_code == 503
    body = resp.json()
    assert body["status"] == "not_ready"
    assert body["checks"]["database"].startswith("error:")
    assert body["checks"]["redis"] == "ok"


# ── 限流 ───────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_rate_limit_triggers_429(client, monkeypatch):
    """把窗口调到 3 次/分钟后，第 4 个请求应被 429 且带 Retry-After。"""
    import app.middleware as middleware_module

    monkeypatch.setattr(middleware_module.settings, "RATE_LIMIT_REQUESTS", 3)
    monkeypatch.setattr(middleware_module.settings, "RATE_LIMIT_WINDOW", 60)

    # 用独立 IP 隔离计数，避免同时间窗内其他用例的请求干扰
    headers = {"X-Forwarded-For": "10.99.0.1"}
    for _ in range(3):
        resp = await client.get("/api/v1/billing/plans", headers=headers)
        assert resp.status_code == 200
    resp = await client.get("/api/v1/billing/plans", headers=headers)
    assert resp.status_code == 429
    assert "Retry-After" in resp.headers
    assert int(resp.headers["Retry-After"]) >= 1


@pytest.mark.asyncio
async def test_global_rate_limit_response_is_english_only(client, monkeypatch):
    import app.middleware as middleware_module

    monkeypatch.setattr(middleware_module.settings, "RATE_LIMIT_REQUESTS", 1)
    monkeypatch.setattr(middleware_module.settings, "RATE_LIMIT_WINDOW", 60)
    monkeypatch.setattr(middleware_module.settings, "MARKET_REGION", "global")
    headers = {"X-Forwarded-For": "10.99.0.2"}

    assert (await client.get("/api/v1/billing/plans", headers=headers)).status_code == 200
    response = await client.get("/api/v1/billing/plans", headers=headers)

    assert response.status_code == 429
    assert response.json()["message"] == "Too many requests. Please try again later."
    assert not any("\u3400" <= char <= "\u9fff" for char in response.text)


@pytest.mark.asyncio
async def test_rate_limit_exempt_paths(client, monkeypatch):
    """/health、/ready、/metrics 不参与限流。"""
    import app.middleware as middleware_module

    monkeypatch.setattr(middleware_module.settings, "RATE_LIMIT_REQUESTS", 1)
    for _ in range(3):
        assert (await client.get("/health")).status_code == 200
        assert (await client.get("/ready")).status_code == 200


# ── GDPR 隐私端点 ──────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_export_and_delete_account(client, db_session, seeded_user):
    user, headers = seeded_user

    export = await client.get("/api/v1/privacy/export-data", headers=headers)
    assert export.status_code == 200
    data = export.json()
    assert data["profile"]["id"] == user.id
    assert len(data["projects"]) == 1
    assert data["projects"][0]["name"] == "隐私测试项目"
    assert len(data["reports"]) == 1
    assert "exported_at" in data

    delete = await client.post("/api/v1/privacy/delete-account", headers=headers)
    assert delete.status_code == 200
    assert delete.json()["deleted"] is True

    # 用户及其项目/报告均已删除（导出 404，DB 查无记录）
    reexport = await client.get("/api/v1/privacy/export-data", headers=headers)
    assert reexport.status_code == 404
    remaining_projects = (
        await db_session.execute(select(Project).where(Project.user_id == user.id))
    ).scalars().all()
    remaining_reports = (
        await db_session.execute(select(Report).where(Report.user_id == user.id))
    ).scalars().all()
    remaining_users = (
        await db_session.execute(select(User).where(User.id == user.id))
    ).scalars().all()
    assert remaining_projects == []
    assert remaining_reports == []
    assert remaining_users == []


@pytest.mark.asyncio
async def test_privacy_endpoints_require_auth(client):
    assert (await client.get("/api/v1/privacy/export-data")).status_code == 401
    assert (await client.post("/api/v1/privacy/delete-account")).status_code == 401


# ── 安全响应头 ─────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_security_headers_present(client):
    resp = await client.get("/health")
    assert resp.headers["X-Content-Type-Options"] == "nosniff"
    assert resp.headers["X-Frame-Options"] == "DENY"
    assert resp.headers["Referrer-Policy"] == "strict-origin-when-cross-origin"


# ── personalization/daily-layout ───────────────────────────────────────────────
@pytest.mark.asyncio
async def test_daily_layout_ok(client, auth_headers):
    resp = await client.get(
        "/api/v1/personalization/daily-layout",
        params={"persona_id": "chen_xin", "day": 1},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["persona_id"] == "chen_xin"
    assert body["day"] == 1
    assert body["hero"]["evidence_status"] == "demo"
    assert body["widgets"]


@pytest.mark.asyncio
async def test_daily_layout_unknown_persona_404(client, auth_headers):
    resp = await client.get(
        "/api/v1/personalization/daily-layout",
        params={"persona_id": "no_such_persona", "day": 1},
        headers=auth_headers,
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_daily_layout_invalid_day_422(client, auth_headers):
    for day in (0, 8):
        resp = await client.get(
            "/api/v1/personalization/daily-layout",
            params={"persona_id": "chen_xin", "day": day},
            headers=auth_headers,
        )
        assert resp.status_code == 422


@pytest.mark.asyncio
async def test_daily_layout_requires_auth(client):
    resp = await client.get(
        "/api/v1/personalization/daily-layout",
        params={"persona_id": "chen_xin", "day": 1},
    )
    assert resp.status_code == 401
