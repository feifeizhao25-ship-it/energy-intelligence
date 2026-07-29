"""
订阅配额管理 — 报告导出配额的校验与扣减。

恢复说明：原文件首尾两个函数（_check_quota / check_report_quota）是残片，
这里按现有函数体的真实行为补齐头部（QuotaExceeded、PLAN_QUOTAS、_get_user）
并补全残片函数。
"""

from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import Project
from app.models.user import User


class QuotaExceeded(Exception):
    """配额耗尽。status_code 供 API 层映射为 429。"""

    status_code = 429

    def __init__(self, quota_type: str, limit: int, current_count: int) -> None:
        self.quota_type = quota_type
        self.limit = limit
        self.current_count = current_count
        super().__init__(
            f"quota exceeded: {quota_type} limit={limit} current={current_count}"
        )


PLAN_QUOTAS = {
    "free": {"report_exports_per_month": 5, "ai_queries_per_day": 20},
    "pro": {"report_exports_per_month": 50, "ai_queries_per_day": 200},
    "enterprise": {"report_exports_per_month": -1, "ai_queries_per_day": -1},
}


# 会员权益单一事实源。数值型权益中 -1 一律表示无限。
ENTITLEMENTS = {
    "free": {
        "report_exports_per_month": 5,
        "ai_queries_per_day": 20,
        "max_projects": 1,
        "data_sources": ["basic"],
        "export_formats": ["pdf"],
        "team_seats": 1,
        "support_level": "community",
    },
    "pro": {
        "report_exports_per_month": 50,
        "ai_queries_per_day": 200,
        "max_projects": 10,
        "data_sources": ["basic", "premium_weather", "grid_tariff"],
        "export_formats": ["pdf", "docx"],
        "team_seats": 5,
        "support_level": "email",
    },
    "enterprise": {
        "report_exports_per_month": -1,
        "ai_queries_per_day": -1,
        "max_projects": -1,
        "data_sources": ["all"],
        "export_formats": ["pdf", "docx", "api"],
        "team_seats": -1,
        "support_level": "dedicated",
    },
}


async def _get_user(user_id: str, db: AsyncSession) -> User:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise LookupError(f"user not found: {user_id}")
    return user


def _period_usage(user: User, category: str, period_key: str) -> int:
    """Read one counter from the canonical per-user usage document."""
    usage = dict(user.usage_quota or {})
    counters = dict(usage.get(category, {}))
    return int(counters.get(period_key, 0) or 0)


async def _check_quota(
    user: User, category: str, quota_type: str, period_key: str, limit: int
) -> None:
    """Raise QuotaExceeded when the period counter reached the limit (-1 = unlimited)."""
    if limit == -1:
        return
    current_count = _period_usage(user, category, period_key)
    if current_count >= limit:
        raise QuotaExceeded(quota_type, limit, current_count)


async def assert_report_quota(user_id: str, db: AsyncSession) -> User:
    """Validate report quota without consuming it.

    Generation performs validation first and records usage only after the job
    has been accepted. This prevents invalid projects or failed validation
    requests from consuming a paid entitlement.
    """
    user = await _get_user(user_id, db)
    plan = user.subscription_plan or "free"
    limit = PLAN_QUOTAS.get(plan, PLAN_QUOTAS["free"]).get(
        "report_exports_per_month", 5
    )
    if limit != -1:
        month_key = f"monthly_{datetime.now(timezone.utc).strftime('%Y-%m')}"
        used = _period_usage(user, "report_exports", month_key)
        if used >= limit:
            raise QuotaExceeded("report_exports_per_month", limit, used)
    return user


async def consume_report_quota(user: User, db: AsyncSession) -> None:
    """Record one accepted report generation request."""
    plan = user.subscription_plan or "free"
    limit = PLAN_QUOTAS.get(plan, PLAN_QUOTAS["free"]).get(
        "report_exports_per_month", 5
    )
    if limit == -1:
        return
    usage = dict(user.usage_quota or {})
    report_usage = dict(usage.get("report_exports", {}))
    month_key = f"monthly_{datetime.now(timezone.utc).strftime('%Y-%m')}"
    report_usage[month_key] = int(report_usage.get(month_key, 0) or 0) + 1
    usage["report_exports"] = report_usage
    user.usage_quota = usage
    await db.commit()


async def check_report_quota(user_id: str, db: AsyncSession) -> None:
    """兼容旧依赖：检查并立即扣减一次报告配额。"""
    user = await assert_report_quota(user_id, db)
    await consume_report_quota(user, db)


async def assert_ai_quota(user_id: str, db: AsyncSession) -> User:
    """校验 AI 问答日配额（ai_queries_per_day，free 20 次/日，-1 = 无限）。"""
    user = await _get_user(user_id, db)
    plan = user.subscription_plan or "free"
    limit = PLAN_QUOTAS.get(plan, PLAN_QUOTAS["free"]).get("ai_queries_per_day", 20)
    if limit != -1:
        day_key = f"daily_{datetime.now(timezone.utc).strftime('%Y-%m-%d')}"
        used = _period_usage(user, "ai_calls", day_key)
        if used >= limit:
            raise QuotaExceeded("ai_queries_per_day", limit, used)
    return user


async def consume_ai_quota(user: User, db: AsyncSession) -> None:
    """记录一次已受理的 AI 问答。"""
    plan = user.subscription_plan or "free"
    limit = PLAN_QUOTAS.get(plan, PLAN_QUOTAS["free"]).get("ai_queries_per_day", 20)
    if limit == -1:
        return
    usage = dict(user.usage_quota or {})
    ai_usage = dict(usage.get("ai_calls", {}))
    day_key = f"daily_{datetime.now(timezone.utc).strftime('%Y-%m-%d')}"
    ai_usage[day_key] = int(ai_usage.get(day_key, 0) or 0) + 1
    usage["ai_calls"] = ai_usage
    user.usage_quota = usage
    await db.commit()


def _plan_entitlements(user: User) -> dict:
    plan = user.subscription_plan or "free"
    return ENTITLEMENTS.get(plan, ENTITLEMENTS["free"])


def check_numeric_entitlement(user: User, key: str) -> int:
    """返回数值型权益上限；-1 一律表示无限。"""
    value = _plan_entitlements(user).get(key)
    if not isinstance(value, int) or isinstance(value, bool):
        raise KeyError(f"entitlement is not numeric: {key}")
    return value


async def assert_entitlement(
    user: User, feature: str, db: AsyncSession = None
) -> None:
    """校验布尔/枚举类权益，未授权时抛 QuotaExceeded。

    feature 形如 ``"data_sources:premium_weather"``（列表成员，列表含
    ``"all"`` 视为全量授权）或 ``"support_level:dedicated"``（枚举精确
    匹配）。``db`` 预留给未来需要落库/记账的权益，当前不使用。
    """
    key, _, value = feature.partition(":")
    entitlements = _plan_entitlements(user)
    if key and value:
        granted = entitlements.get(key)
        if isinstance(granted, list):
            allowed = "all" in granted or value in granted
        else:
            allowed = granted == value
    else:
        # 无 key 前缀：在所有列表型权益中查找该特性
        allowed = any(
            isinstance(v, list) and ("all" in v or feature in v)
            for v in entitlements.values()
        )
    if not allowed:
        raise QuotaExceeded(f"entitlement:{feature}", 0, 0)


async def assert_project_quota(user_id: str, db: AsyncSession) -> User:
    """校验项目数量配额（max_projects，-1 = 无限），超限抛 QuotaExceeded。"""
    user = await _get_user(user_id, db)
    limit = check_numeric_entitlement(user, "max_projects")
    if limit == -1:
        return user
    result = await db.execute(
        select(func.count(Project.id)).where(Project.user_id == user_id)
    )
    current_count = int(result.scalar_one())
    if current_count >= limit:
        raise QuotaExceeded("max_projects", limit, current_count)
    return user
