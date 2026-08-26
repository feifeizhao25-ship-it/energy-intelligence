"""Report quota and ownership regression tests."""

from datetime import datetime, timezone
import uuid

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.subscription import (
    QuotaExceeded,
    assert_report_quota,
    consume_report_quota,
)
from app.models.user import User
from app.utils.security import get_password_hash


@pytest_asyncio.fixture
async def report_quota_user(setup_database, db_session: AsyncSession) -> User:
    uid = str(uuid.uuid4())
    user = User(
        id=uid,
        phone=f"136{uid[:8]}",
        password_hash=get_password_hash("ReportPass123!"),
        name="报告配额测试用户",
        role="user",
        market="cn",
        subscription_plan="free",
        usage_quota={"ai_calls": {}, "report_exports": {}},
    )
    db_session.add(user)
    await db_session.commit()
    return user


@pytest.mark.asyncio
async def test_report_quota_is_not_consumed_by_validation(
    report_quota_user: User,
    db_session: AsyncSession,
):
    user = await assert_report_quota(str(report_quota_user.id), db_session)
    assert user.usage_quota.get("report_exports", {}) == {}

    await consume_report_quota(user, db_session)
    month_key = f"monthly_{datetime.now(timezone.utc).strftime('%Y-%m')}"
    assert user.usage_quota["report_exports"][month_key] == 1


@pytest.mark.asyncio
async def test_report_quota_rejects_exhausted_user(
    report_quota_user: User,
    db_session: AsyncSession,
):
    month_key = f"monthly_{datetime.now(timezone.utc).strftime('%Y-%m')}"
    report_quota_user.usage_quota = {
        "ai_calls": {},
        "report_exports": {month_key: 5},
    }
    await db_session.commit()

    with pytest.raises(QuotaExceeded) as error:
        await assert_report_quota(str(report_quota_user.id), db_session)
    assert error.value.status_code == 429
