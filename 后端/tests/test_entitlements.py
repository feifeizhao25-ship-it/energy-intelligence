"""会员权益矩阵（ENTITLEMENTS）单一事实源与全权益断言测试。"""

import uuid

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.subscription import (
    ENTITLEMENTS,
    QuotaExceeded,
    assert_entitlement,
    assert_project_quota,
    check_numeric_entitlement,
)
from app.models.database import Project
from app.models.user import User
from app.utils.security import get_password_hash

EXPECTED_KEYS = {
    "report_exports_per_month",
    "ai_queries_per_day",
    "max_projects",
    "data_sources",
    "export_formats",
    "team_seats",
    "support_level",
}


def _make_user(plan: str) -> User:
    """构造未落库的内存用户，用于纯权益逻辑断言。"""
    uid = str(uuid.uuid4())
    return User(
        id=uid,
        phone=f"137{uuid.uuid4().hex[:8]}",
        password_hash=get_password_hash("EntitlePass123!"),
        name="权益测试用户",
        role="user",
        market="cn",
        subscription_plan=plan,
        usage_quota={"ai_calls": {}, "report_exports": {}},
    )


@pytest_asyncio.fixture
async def persisted_user(db_session: AsyncSession):
    """落库用户工厂：按 plan 创建并返回 User。"""

    async def _create(plan: str) -> User:
        user = _make_user(plan)
        db_session.add(user)
        await db_session.commit()
        return user

    return _create


async def _add_projects(db_session: AsyncSession, user_id: str, count: int) -> None:
    for i in range(count):
        db_session.add(Project(
            id=str(uuid.uuid4()),
            user_id=user_id,
            name=f"权益测试项目-{i}",
        ))
    await db_session.commit()


# ── 矩阵完整性 ────────────────────────────────────────────────────────────────

def test_entitlements_matrix_has_all_plans_and_keys():
    assert set(ENTITLEMENTS.keys()) == {"free", "pro", "enterprise"}
    for plan, entitlements in ENTITLEMENTS.items():
        assert set(entitlements.keys()) == EXPECTED_KEYS, (
            f"plan {plan} 权益项不完整: {set(entitlements.keys())}"
        )


def test_entitlements_matrix_values():
    assert ENTITLEMENTS["free"]["max_projects"] == 1
    assert ENTITLEMENTS["pro"]["max_projects"] == 10
    assert ENTITLEMENTS["enterprise"]["max_projects"] == -1
    assert ENTITLEMENTS["free"]["data_sources"] == ["basic"]
    assert ENTITLEMENTS["pro"]["data_sources"] == [
        "basic", "premium_weather", "grid_tariff",
    ]
    assert ENTITLEMENTS["enterprise"]["data_sources"] == ["all"]
    assert ENTITLEMENTS["free"]["export_formats"] == ["pdf"]
    assert ENTITLEMENTS["pro"]["export_formats"] == ["pdf", "docx"]
    assert ENTITLEMENTS["enterprise"]["export_formats"] == ["pdf", "docx", "api"]
    assert ENTITLEMENTS["free"]["team_seats"] == 1
    assert ENTITLEMENTS["pro"]["team_seats"] == 5
    assert ENTITLEMENTS["enterprise"]["team_seats"] == -1
    assert ENTITLEMENTS["free"]["support_level"] == "community"
    assert ENTITLEMENTS["pro"]["support_level"] == "email"
    assert ENTITLEMENTS["enterprise"]["support_level"] == "dedicated"


# ── -1 无限语义 ──────────────────────────────────────────────────────────────

def test_minus_one_means_unlimited_for_enterprise():
    user = _make_user("enterprise")
    assert check_numeric_entitlement(user, "report_exports_per_month") == -1
    assert check_numeric_entitlement(user, "ai_queries_per_day") == -1
    assert check_numeric_entitlement(user, "max_projects") == -1
    assert check_numeric_entitlement(user, "team_seats") == -1


def test_check_numeric_entitlement_rejects_non_numeric_key():
    user = _make_user("free")
    with pytest.raises(KeyError):
        check_numeric_entitlement(user, "data_sources")


def test_check_numeric_entitlement_unknown_plan_falls_back_to_free():
    user = _make_user("nonexistent-plan")
    assert check_numeric_entitlement(user, "max_projects") == 1


# ── assert_entitlement 允许/拒绝边界 ─────────────────────────────────────────

@pytest.mark.asyncio
async def test_assert_entitlement_allows_granted_features():
    free_user = _make_user("free")
    await assert_entitlement(free_user, "data_sources:basic")
    await assert_entitlement(free_user, "export_formats:pdf")
    await assert_entitlement(free_user, "support_level:community")

    pro_user = _make_user("pro")
    await assert_entitlement(pro_user, "data_sources:premium_weather")
    await assert_entitlement(pro_user, "data_sources:grid_tariff")
    await assert_entitlement(pro_user, "export_formats:docx")

    enterprise_user = _make_user("enterprise")
    await assert_entitlement(enterprise_user, "export_formats:api")
    await assert_entitlement(enterprise_user, "support_level:dedicated")


@pytest.mark.asyncio
async def test_assert_entitlement_enterprise_all_covers_any_data_source():
    user = _make_user("enterprise")
    # data_sources 含 "all"，任意数据源均视为已授权
    await assert_entitlement(user, "data_sources:premium_weather")
    await assert_entitlement(user, "data_sources:anything_at_all")


@pytest.mark.asyncio
async def test_assert_entitlement_rejects_ungranted_features():
    free_user = _make_user("free")
    with pytest.raises(QuotaExceeded) as error:
        await assert_entitlement(free_user, "data_sources:premium_weather")
    assert error.value.status_code == 429

    with pytest.raises(QuotaExceeded):
        await assert_entitlement(free_user, "export_formats:docx")

    pro_user = _make_user("pro")
    with pytest.raises(QuotaExceeded):
        await assert_entitlement(pro_user, "export_formats:api")
    with pytest.raises(QuotaExceeded):
        await assert_entitlement(pro_user, "support_level:dedicated")


# ── assert_project_quota 超限验证（落库） ────────────────────────────────────

@pytest.mark.asyncio
async def test_assert_project_quota_allows_below_limit(
    persisted_user, db_session: AsyncSession
):
    user = await persisted_user("free")
    checked = await assert_project_quota(str(user.id), db_session)
    assert checked.id == user.id


@pytest.mark.asyncio
async def test_assert_project_quota_rejects_at_limit(
    persisted_user, db_session: AsyncSession
):
    user = await persisted_user("free")
    await _add_projects(db_session, str(user.id), 1)  # free max_projects = 1

    with pytest.raises(QuotaExceeded) as error:
        await assert_project_quota(str(user.id), db_session)
    assert error.value.quota_type == "max_projects"
    assert error.value.limit == 1
    assert error.value.current_count == 1
    assert error.value.status_code == 429


@pytest.mark.asyncio
async def test_assert_project_quota_pro_limit(
    persisted_user, db_session: AsyncSession
):
    user = await persisted_user("pro")
    await _add_projects(db_session, str(user.id), 9)
    await assert_project_quota(str(user.id), db_session)  # 9 < 10，允许

    await _add_projects(db_session, str(user.id), 1)
    with pytest.raises(QuotaExceeded) as error:
        await assert_project_quota(str(user.id), db_session)
    assert error.value.limit == 10
    assert error.value.current_count == 10


@pytest.mark.asyncio
async def test_assert_project_quota_enterprise_unlimited(
    persisted_user, db_session: AsyncSession
):
    user = await persisted_user("enterprise")
    await _add_projects(db_session, str(user.id), 25)
    await assert_project_quota(str(user.id), db_session)  # -1 无限，不抛


@pytest.mark.asyncio
async def test_assert_project_quota_unknown_user(db_session: AsyncSession):
    with pytest.raises(LookupError):
        await assert_project_quota(str(uuid.uuid4()), db_session)


# ── /billing/plans 与 ENTITLEMENTS 一致 ──────────────────────────────────────

@pytest.mark.asyncio
async def test_billing_plans_endpoint_reflects_entitlements(client):
    response = await client.get("/api/v1/billing/plans")
    assert response.status_code == 200
    body = response.json()
    assert body["code"] == 0
    plans = body["data"]["plans"]
    assert [p["id"] for p in plans] == ["free", "pro", "enterprise"]

    for plan in plans:
        assert plan["entitlements"] == ENTITLEMENTS[plan["id"]]
        # 顶层旧字段保持兼容
        assert plan["report_exports_per_month"] == (
            ENTITLEMENTS[plan["id"]]["report_exports_per_month"]
        )
        assert plan["ai_queries_per_day"] == (
            ENTITLEMENTS[plan["id"]]["ai_queries_per_day"]
        )
        assert plan["currency"] == "CNY"
