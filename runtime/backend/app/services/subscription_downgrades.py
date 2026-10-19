"""Transactional expiry processing. Never creates a new paid entitlement period."""
from datetime import datetime, timezone
from sqlalchemy import or_, select
from app.models.user import User
from app.services.billing_rules import TIER_ORDER, _utc


async def process_due_downgrades(db, *, now=None, batch_size=200):
    now = _utc(now or datetime.now(timezone.utc))
    if not 1 <= batch_size <= 1000:
        raise ValueError("批次大小须在1到1000之间")
    users = (await db.execute(
        select(User).where(
            User.market == "cn",
            User.usage_quota["scheduled_downgrade"]["status"].as_string() == "scheduled",
            or_(User.subscription_expires_at <= now, User.subscription_expires_at.is_(None)),
        ).order_by(User.id).limit(batch_size).with_for_update(skip_locked=True)
        .execution_options(populate_existing=True)
    )).scalars().all()
    counts = {"applied": 0, "cancelled": 0}
    for user in users:
        usage = dict(user.usage_quota or {})
        intent = dict(usage["scheduled_downgrade"])
        try:
            effective = _utc(datetime.fromisoformat(intent["effective_at"]))
            source, target = intent["from_plan"], intent["to_plan"]
            valid = (source in TIER_ORDER and target in TIER_ORDER
                     and TIER_ORDER.index(target) < TIER_ORDER.index(source)
                     and user.subscription_plan == source
                     and user.subscription_expires_at is not None
                     and _utc(user.subscription_expires_at) == effective
                     and effective <= now)
        except (KeyError, TypeError, ValueError):
            valid = False
        status = "applied" if valid else "cancelled"
        if valid:
            user.subscription_plan = target
        intent.update(status=status, processed_at=now.isoformat())
        if not valid:
            intent["reason"] = "订阅周期或档位已变化，或申请数据无效"
        usage["scheduled_downgrade"] = intent
        user.usage_quota = usage
        counts[status] += 1
    # Caller owns commit/rollback; expiry and other usage counters are preserved.
    return counts
