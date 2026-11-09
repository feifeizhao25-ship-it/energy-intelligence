"""User-facing alerts.

Policy subscriptions are rows in policy_alert_subscriptions. Saved policy rules
are alert_rules. Project alarms are operation_alarm_events on the caller's projects.
There is no price-alert table, so the price section says so instead of inventing rows.
"""
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user_id
from app.core.subscription import _REGISTRY, _get_user
from app.models.alert import AlertRule
from app.models.database import Project
from app.models.operation_telemetry import OperationAlarmEvent
from app.models.product_usage import PolicyAlertSubscription

router = APIRouter(prefix="/alerts")

_PRICE_UNAVAILABLE = "没有电价提醒数据源，不生成价格告警"


class PolicySubscriptionCreate(BaseModel):
    province: str = Field(..., min_length=1, max_length=32)
    topic: str = Field("", max_length=120)


def _policy_level(plan: str) -> str:
    tier = (_REGISTRY.get("tiers") or {}).get(plan) or _REGISTRY["tiers"]["free"]
    return str((tier.get("capabilities") or {}).get("policy_alerts") or "none")


def _subscription_payload(row: PolicyAlertSubscription) -> dict:
    return {
        "id": row.id,
        "province": row.province,
        "topic": row.topic or "",
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


def _rule_payload(row: AlertRule) -> dict:
    return {
        "id": row.id,
        "name": row.name,
        "source_id": row.source_id,
        "threshold": row.threshold,
        "enabled": row.enabled,
        "last_impact_score": row.last_impact_score,
        "last_triggered_at": row.last_triggered_at.isoformat() if row.last_triggered_at else None,
    }


@router.get("")
async def list_alerts(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    subscriptions = (await db.execute(
        select(PolicyAlertSubscription)
        .where(PolicyAlertSubscription.user_id == user_id)
        .order_by(PolicyAlertSubscription.created_at.desc())
    )).scalars().all()
    rules = (await db.execute(
        select(AlertRule).where(AlertRule.user_id == user_id).order_by(AlertRule.created_at.desc())
    )).scalars().all()
    project_ids = (await db.execute(select(Project.id).where(Project.user_id == user_id))).scalars().all()
    events = []
    if project_ids:
        events = (await db.execute(
            select(OperationAlarmEvent)
            .where(OperationAlarmEvent.project_id.in_(project_ids))
            .order_by(OperationAlarmEvent.created_at.desc())
        )).scalars().all()
    return {
        "policy": {
            "subscriptions": [_subscription_payload(row) for row in subscriptions],
            "rules": [_rule_payload(row) for row in rules],
        },
        "project": {
            "alerts": [{
                "id": event.id,
                "project_id": event.project_id,
                "severity": event.severity,
                "message": event.message,
                "acknowledged_at": event.acknowledged_at.isoformat() if event.acknowledged_at else None,
            } for event in events],
        },
        "price": {"available": False, "reason": _PRICE_UNAVAILABLE},
    }


@router.post("/subscriptions", status_code=201)
async def create_policy_subscription(
    body: PolicySubscriptionCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    user = await _get_user(user_id, db)
    level = _policy_level(user.plan)
    if level == "none":
        raise HTTPException(status_code=403, detail="当前套餐不含政策提醒")
    topic = body.topic.strip()
    if level == "province_topic" and len(topic) > 40:
        raise HTTPException(status_code=400, detail="主题过长")
    row = PolicyAlertSubscription(
        id=str(uuid4()),
        user_id=user_id,
        province=body.province.strip(),
        topic=topic,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return {"data": _subscription_payload(row)}


@router.delete("/subscriptions/{subscription_id}")
async def delete_policy_subscription(
    subscription_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    row = (await db.execute(
        select(PolicyAlertSubscription).where(
            PolicyAlertSubscription.id == subscription_id,
            PolicyAlertSubscription.user_id == user_id,
        )
    )).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="提醒不存在或无权访问")
    await db.delete(row)
    await db.commit()
    return {"data": {"id": subscription_id, "deleted": True}}
