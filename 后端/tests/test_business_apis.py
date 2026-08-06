"""EnergyIQ 必备业务 API 测试。

覆盖端点：
- GET  /api/v1/policies                    政策/标准清单（鉴权）
- GET  /api/v1/policies/{source_id}/impact KA-070 影响评估（>0.7 → alert）
- GET  /api/v1/data/market                 价格条目（stale fail-closed 不出数值）
- GET/POST/DELETE /api/v1/alerts           用户级提醒规则 CRUD（落库）
- POST /api/v1/ai/ask                      RAG 问答（无 LLM 不编造 + 日配额 429）
- POST /api/v1/reports/custom              定制报告（202 + 落库字段 + 权益 429）
- POST /api/v1/billing/checkout|webhook    Stripe 未配置 503 / 验签失败 400
"""

import uuid
from datetime import datetime, timezone

import pytest
import pytest_asyncio

from app.config import settings
from app.core.security import create_access_token
from app.models.alert import AlertRule
from app.models.database import Project
from app.models.report import Report
from app.models.user import User
from app.services.rag_sources import SourceRegistry
from app.utils.security import get_password_hash
from sqlalchemy import select

_LLM_SETTINGS_KEYS = (
    "DASHSCOPE_API_KEY",
    "DEEPSEEK_API_KEY",
    "GLM_API_KEY",
    "ANTHROPIC_API_KEY",
    "OPENAI_API_KEY",
)
_LLM_ENV_KEYS = _LLM_SETTINGS_KEYS + ("APP_ENV", "ENVIRONMENT")


@pytest.fixture(autouse=True)
def _no_llm(monkeypatch):
    """确定性：屏蔽 LLM 配置（settings 与环境变量），走规则法/检索原文分支。"""
    for key in _LLM_SETTINGS_KEYS:
        monkeypatch.setattr(settings, key, None, raising=False)
        monkeypatch.delenv(key, raising=False)


async def _create_user(db_session, plan="pro", usage_quota=None, market="cn"):
    user = User(
        id=str(uuid.uuid4()),
        phone=f"138{uuid.uuid4().hex[:8]}",
        password_hash=get_password_hash("TestPass123!"),
        name="业务测试用户",
        role="user",
        market=market,
        subscription_plan=plan,
        usage_quota=usage_quota or {"ai_calls": {}, "report_exports": {}},
    )
    db_session.add(user)
    await db_session.commit()
    return user


def _headers(user):
    return {"Authorization": f"Bearer {create_access_token(str(user.id))}"}


@pytest_asyncio.fixture
async def pro_user(db_session):
    return await _create_user(db_session, plan="pro")


@pytest_asyncio.fixture
async def free_user(db_session):
    return await _create_user(db_session, plan="free")


async def _create_project(db_session, user):
    project = Project(
        id=str(uuid.uuid4()),
        user_id=user.id,
        name="业务测试光伏项目",
        technology="solar",
        capacity_mw=10.0,
    )
    db_session.add(project)
    await db_session.commit()
    return project


# ── /policies ────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_policies_requires_auth(client):
    resp = await client.get("/api/v1/policies")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_policies_list(client, pro_user):
    resp = await client.get("/api/v1/policies", headers=_headers(pro_user))
    assert resp.status_code == 200
    entries = resp.json()["data"]
    assert entries, "注册表应含政策/标准条目"
    for entry in entries:
        assert entry["type"] in ("policy", "standard")
        for field in (
            "title",
            "source_url",
            "source_org",
            "last_verified_at",
            "freshness_status",
            "verification",
        ):
            assert entry[field], f"缺少字段 {field}"
        assert entry["freshness_status"] in ("current", "review_recommended", "stale")
        assert entry["verification"] in ("verified", "single_source")
    # 价格类条目不应混入
    assert all(not e["source_id"].startswith("price-") for e in entries)


@pytest.mark.asyncio
async def test_policy_impact_rule_based(client, pro_user):
    resp = await client.get(
        "/api/v1/policies/policy-cn-136/impact", headers=_headers(pro_user)
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["source_id"] == "policy-cn-136"
    assert 0.0 <= data["impact_score"] <= 1.0
    assert isinstance(data["alert"], bool)
    # 无 LLM 时规则法降级并如实标注 engine
    assert "rule_based" in data["engine"]
    assert data["estimated"] is True
    # policy-cn-136 只命中并网类（0.35），不超过 0.7 阈值
    assert data["impact_score"] == pytest.approx(0.35)
    assert data["alert"] is False


@pytest.mark.asyncio
async def test_policy_impact_404(client, pro_user):
    resp = await client.get(
        "/api/v1/policies/no-such-source/impact", headers=_headers(pro_user)
    )
    assert resp.status_code == 404
    # 价格类条目不做政策影响评估
    resp = await client.get(
        "/api/v1/policies/price-cn-module/impact", headers=_headers(pro_user)
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_policy_impact_requires_auth(client):
    resp = await client.get("/api/v1/policies/policy-cn-136/impact")
    assert resp.status_code == 401


# ── /data/market ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_market_requires_auth(client):
    resp = await client.get("/api/v1/data/market")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_market_lists_price_entries(client, pro_user):
    resp = await client.get("/api/v1/data/market", headers=_headers(pro_user))
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["total"] >= 2  # price-cn-module / price-us-eia
    for item in data["items"]:
        assert item["verify_interval_days"] == 7
        assert item["freshness_status"] in ("current", "review_recommended", "stale")
        assert item["stale"] == (item["freshness_status"] == "stale")


@pytest.mark.asyncio
async def test_market_stale_fail_closed(client, pro_user, monkeypatch):
    """过期价格条目：标 stale 且不出数值（fail-closed）；新鲜条目正常出内容。"""
    stale_source = {
        "source_id": "price-stale-test",
        "type": "price",
        "lang": "cn",
        "title": "过期行情",
        "content": "SECRET-PRICE-VALUE 不应外泄",
        "year": 2025,
        "last_verified_at": "2020-01-01",
        "source_url": "https://example.org/stale",
        "source_org": "测试机构",
        "license_note": "test",
        "verify_interval_days": 7,
    }
    fresh_source = dict(stale_source)
    fresh_source.update(
        {
            "source_id": "price-fresh-test",
            "title": "新鲜行情",
            "content": "本周组件价格区间",
            "last_verified_at": datetime.now(timezone.utc).date().isoformat(),
        }
    )
    registry = SourceRegistry([stale_source, fresh_source])
    monkeypatch.setattr("app.api.v1.market._get_registry", lambda: registry)

    resp = await client.get("/api/v1/data/market", headers=_headers(pro_user))
    assert resp.status_code == 200
    data = resp.json()["data"]
    items = {item["source_id"]: item for item in data["items"]}

    stale_item = items["price-stale-test"]
    assert stale_item["stale"] is True
    assert stale_item["freshness_status"] == "stale"
    assert stale_item["content"] is None  # fail-closed：过期不出数值
    assert "SECRET-PRICE-VALUE" not in resp.text

    fresh_item = items["price-fresh-test"]
    assert fresh_item["stale"] is False
    assert fresh_item["content"] == "本周组件价格区间"

    assert data["stale_count"] == 1
    assert "note" in data


# ── /alerts ──────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_alerts_require_auth(client):
    assert (await client.get("/api/v1/alerts")).status_code == 401
    assert (
        await client.post("/api/v1/alerts", json={"name": "x", "source_id": "y"})
    ).status_code == 401
    assert (await client.delete("/api/v1/alerts/whatever")).status_code == 401


@pytest.mark.asyncio
async def test_alerts_crud(client, pro_user, db_session):
    headers = _headers(pro_user)

    # 创建：阈值 0.0，policy-cn-136 评分 0.35 > 0 → 触发
    resp = await client.post(
        "/api/v1/alerts",
        json={"name": "136 号文提醒", "source_id": "policy-cn-136", "threshold": 0.0},
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()["data"]
    assert data["triggered"] is True
    assert data["evaluation"]["impact_score"] == pytest.approx(0.35)
    rule_id = data["rule"]["id"]
    assert data["rule"]["last_triggered_at"] is not None

    # 创建：阈值 1.0，不会触发
    resp = await client.post(
        "/api/v1/alerts",
        json={"name": "高阈值规则", "source_id": "policy-cn-136", "threshold": 1.0},
        headers=headers,
    )
    assert resp.status_code == 201
    assert resp.json()["data"]["triggered"] is False

    # 创建：未知条目 404
    resp = await client.post(
        "/api/v1/alerts",
        json={"name": "bad", "source_id": "no-such-source"},
        headers=headers,
    )
    assert resp.status_code == 404

    # 列表
    resp = await client.get("/api/v1/alerts", headers=headers)
    assert resp.status_code == 200
    rules = resp.json()["data"]
    assert len(rules) == 2
    assert {r["source_id"] for r in rules} == {"policy-cn-136"}

    # 落库验证
    result = await db_session.execute(
        select(AlertRule).where(AlertRule.user_id == pro_user.id)
    )
    assert len(result.scalars().all()) == 2

    # 删除
    resp = await client.delete(f"/api/v1/alerts/{rule_id}", headers=headers)
    assert resp.status_code == 200
    resp = await client.get("/api/v1/alerts", headers=headers)
    assert len(resp.json()["data"]) == 1

    # 再删 → 404
    resp = await client.delete(f"/api/v1/alerts/{rule_id}", headers=headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_alerts_cannot_delete_others_rule(client, pro_user, free_user):
    resp = await client.post(
        "/api/v1/alerts",
        json={"name": "pro 的规则", "source_id": "policy-cn-136"},
        headers=_headers(pro_user),
    )
    rule_id = resp.json()["data"]["rule"]["id"]
    resp = await client.delete(f"/api/v1/alerts/{rule_id}", headers=_headers(free_user))
    assert resp.status_code == 404


# ── /ai/ask ──────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_ai_ask_requires_auth(client):
    resp = await client.post("/api/v1/ai/ask", json={"question": "光伏补贴政策"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_ai_ask_no_llm_returns_retrieval_only(client, pro_user, db_session):
    """未配置 LLM：不编造段落，返回检索原文 + 明确标注。"""
    resp = await client.post(
        "/api/v1/ai/ask",
        json={"question": "计量与结算流程要点"},
        headers=_headers(pro_user),
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["generated"] is False
    assert data["answer"] is None
    assert "未接入生成模型" in data["notice"]
    assert data["sources"], "应有检索命中并附来源引用"
    assert data["passages"], "应返回检索原文摘录"
    for source in data["sources"]:
        assert source["source_id"]
        assert source["freshness_status"] in ("current", "review_recommended", "stale")

    # 配额计数：pro 每日 200 次，调用后 ai_calls 当日 +1
    await db_session.refresh(pro_user)
    day_key = f"daily_{datetime.now(timezone.utc).strftime('%Y-%m-%d')}"
    assert pro_user.usage_quota["ai_calls"][day_key] == 1


@pytest.mark.asyncio
async def test_ai_ask_quota_exceeded_429(client, db_session):
    """free 每日 20 次：当日计数已达上限 → 429。"""
    day_key = f"daily_{datetime.now(timezone.utc).strftime('%Y-%m-%d')}"
    user = await _create_user(
        db_session, plan="free", usage_quota={"ai_calls": {day_key: 20}}
    )
    resp = await client.post(
        "/api/v1/ai/ask",
        json={"question": "储能政策"},
        headers=_headers(user),
    )
    assert resp.status_code == 429
    body = resp.json()
    assert body["error"]["quota_type"] == "ai_queries_per_day"
    assert body["error"]["limit"] == 20


# ── /reports/custom ──────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_custom_report_requires_auth(client):
    resp = await client.post(
        "/api/v1/reports/custom", json={"project_id": "x", "format": "pdf"}
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_custom_report_202_and_db_fields(client, pro_user, db_session):
    project = await _create_project(db_session, pro_user)
    resp = await client.post(
        "/api/v1/reports/custom",
        json={"project_id": project.id, "format": "pdf", "title": "季度定制报告"},
        headers=_headers(pro_user),
    )
    assert resp.status_code == 202
    data = resp.json()["data"]
    assert data["status"] == "pending_review"
    assert data["is_premium"] is True
    assert data["reviewed"] is False
    assert "人工终审后发布" in data["message"]

    result = await db_session.execute(
        select(Report).where(Report.id == data["report_id"])
    )
    report = result.scalar_one_or_none()
    assert report is not None
    assert report.is_premium is True
    assert report.reviewed is False
    assert report.status == "pending_review"
    assert report.report_type == "custom"
    assert report.user_id == pro_user.id
    assert report.project_id == project.id


@pytest.mark.asyncio
async def test_custom_report_project_ownership(client, pro_user, free_user, db_session):
    project = await _create_project(db_session, pro_user)
    # 他人项目 → 404
    resp = await client.post(
        "/api/v1/reports/custom",
        json={"project_id": project.id, "format": "pdf"},
        headers=_headers(free_user),
    )
    assert resp.status_code == 404
    # 不存在的项目 → 404
    resp = await client.post(
        "/api/v1/reports/custom",
        json={"project_id": str(uuid.uuid4()), "format": "pdf"},
        headers=_headers(pro_user),
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_custom_report_format_entitlement(client, free_user, db_session):
    """free 仅 pdf：docx/api 越权 429；非法格式 422。"""
    project = await _create_project(db_session, free_user)
    for fmt in ("docx", "api"):
        resp = await client.post(
            "/api/v1/reports/custom",
            json={"project_id": project.id, "format": fmt},
            headers=_headers(free_user),
        )
        assert resp.status_code == 429, fmt
        assert "export_formats" in resp.json()["error"]["quota_type"]

    resp = await client.post(
        "/api/v1/reports/custom",
        json={"project_id": project.id, "format": "xlsx"},
        headers=_headers(free_user),
    )
    assert resp.status_code == 422

    # free + pdf → 202
    resp = await client.post(
        "/api/v1/reports/custom",
        json={"project_id": project.id, "format": "pdf"},
        headers=_headers(free_user),
    )
    assert resp.status_code == 202


# ── /billing ─────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_billing_checkout_requires_auth(client):
    resp = await client.post("/api/v1/billing/checkout", json={"plan": "pro"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_billing_checkout_503_when_unconfigured(client, pro_user, monkeypatch):
    """stripe 未配置 → 503 而非崩溃。"""
    monkeypatch.setattr(settings, "STRIPE_SECRET_KEY", None, raising=False)
    resp = await client.post(
        "/api/v1/billing/checkout", json={"plan": "pro"}, headers=_headers(pro_user)
    )
    assert resp.status_code == 503

    resp = await client.get("/api/v1/billing/portal", headers=_headers(pro_user))
    assert resp.status_code == 503


@pytest.mark.asyncio
async def test_billing_webhook_503_when_unconfigured(client, monkeypatch):
    monkeypatch.setattr(settings, "STRIPE_SECRET_KEY", None, raising=False)
    resp = await client.post(
        "/api/v1/billing/webhook",
        content=b"{}",
        headers={"stripe-signature": "bad"},
    )
    assert resp.status_code == 503


@pytest.mark.asyncio
async def test_billing_webhook_bad_signature_400(client, pro_user, monkeypatch):
    """配置齐全但验签失败 → 400。"""
    stripe = pytest.importorskip("stripe")
    monkeypatch.setattr(settings, "STRIPE_SECRET_KEY", "sk_test_fake", raising=False)
    monkeypatch.setattr(
        settings, "STRIPE_WEBHOOK_SECRET", "whsec_fake", raising=False
    )
    resp = await client.post(
        "/api/v1/billing/webhook",
        content=b'{"type": "customer.subscription.created"}',
        headers={"stripe-signature": "t=1,v1=invalid"},
    )
    assert resp.status_code == 400
