from datetime import datetime, timedelta, timezone

from app.api.v1.billing import subscription_period_end
from app.models.user import User
from app.core.subscription import check_numeric_entitlement, PLAN_QUOTAS


def test_month_end_and_leap_year_are_clamped():
    assert subscription_period_end(datetime(2028, 1, 31, tzinfo=timezone.utc), "monthly") == datetime(2028, 2, 29, tzinfo=timezone.utc)
    assert subscription_period_end(datetime(2028, 2, 29, tzinfo=timezone.utc), "yearly") == datetime(2029, 2, 28, tzinfo=timezone.utc)


def test_expired_paid_plan_uses_free_feature_limits():
    user = User(subscription_plan="full", subscription_expires_at=datetime.now(timezone.utc) - timedelta(seconds=1))
    assert user.plan == "free"
    assert check_numeric_entitlement(user, "ai_queries_per_day") == PLAN_QUOTAS["free"]["ai_queries_per_day"]


def test_active_plan_and_unreconciled_legacy_records_are_preserved():
    user = User(subscription_plan="full", subscription_expires_at=datetime.now(timezone.utc) + timedelta(days=1))
    assert user.plan == "full"
    user.subscription_expires_at = None
    assert user.plan == "full"
