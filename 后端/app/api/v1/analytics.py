"""Authenticated, persisted product analytics with fail-closed revenue handling."""

import json
from datetime import datetime, timezone
from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user_id
from app.models.product_event import ProductEvent
from app.models.user import User

router = APIRouter(prefix="/analytics")

# Financial lifecycle facts may only be created by a verified, idempotent payment
# webhook. Accepting them from a client would make revenue metrics forgeable.
_FINANCIAL_EVENTS = {
    "checkout_started",
    "payment_succeeded",
    "subscription_renewed",
    "subscription_cancelled",
}
_CLIENT_EVENTS = {
    "landing_viewed",
    "dataset_previewed",
    "workspace_created",
    "analysis_completed",
    "report_exported",
    "trial_started",
    "enterprise_lead_qualified",
}
_SENSITIVE_PROPERTY_FRAGMENTS = ("password", "token", "secret", "api_key", "apikey")


def _contains_sensitive_key(value: Any) -> bool:
    if isinstance(value, dict):
        return any(
            isinstance(key, str)
            and any(fragment in key.lower() for fragment in _SENSITIVE_PROPERTY_FRAGMENTS)
            or _contains_sensitive_key(item)
            for key, item in value.items()
        )
    if isinstance(value, list):
        return any(_contains_sensitive_key(item) for item in value)
    return False


class EventIn(BaseModel):
    event_id: UUID
    event_name: str
    workspace_id: Optional[UUID] = None
    locale: str = Field(min_length=2, max_length=20)
    channel: Optional[str] = Field(default=None, max_length=64)
    campaign: Optional[str] = Field(default=None, max_length=128)
    experiment: Optional[str] = Field(default=None, max_length=128)
    occurred_at: datetime
    properties: dict[str, Any] = Field(default_factory=dict)

    @field_validator("event_name")
    @classmethod
    def validate_event_name(cls, value: str) -> str:
        if value in _FINANCIAL_EVENTS:
            raise ValueError("financial events require a verified server-side webhook")
        if value not in _CLIENT_EVENTS:
            raise ValueError("unsupported product event")
        return value

    @field_validator("occurred_at")
    @classmethod
    def require_timezone(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("occurred_at must include a timezone")
        return value.astimezone(timezone.utc)

    @field_validator("properties")
    @classmethod
    def validate_properties(cls, value: dict[str, Any]) -> dict[str, Any]:
        if _contains_sensitive_key(value):
            raise ValueError("properties must not contain credentials or secrets")
        if len(json.dumps(value, ensure_ascii=False, default=str).encode("utf-8")) > 8192:
            raise ValueError("properties must not exceed 8 KiB")
        return value


@router.post("/events", status_code=status.HTTP_201_CREATED)
async def ingest_event(
    body: EventIn,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    event_id = str(body.event_id)
    existing = await db.get(ProductEvent, event_id)
    if existing:
        if existing.user_id != user_id or existing.event_name != body.event_name:
            raise HTTPException(status_code=409, detail="Event ID already exists")
        return {"event_id": event_id, "status": "duplicate", "persisted": True}

    event = ProductEvent(
        event_id=event_id,
        user_id=user_id,
        workspace_id=str(body.workspace_id) if body.workspace_id else None,
        event_name=body.event_name,
        market=user.market or "cn",
        locale=body.locale,
        channel=body.channel,
        campaign=body.campaign,
        experiment=body.experiment,
        occurred_at=body.occurred_at,
        properties=body.properties,
    )
    db.add(event)
    await db.flush()
    return {"event_id": event_id, "status": "accepted", "persisted": True}


@router.get("/summary")
async def analytics_summary(
    since: Optional[datetime] = Query(default=None),
    until: Optional[datetime] = Query(default=None),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    if since and since.tzinfo is None:
        raise HTTPException(status_code=422, detail="since must include a timezone")
    if until and until.tzinfo is None:
        raise HTTPException(status_code=422, detail="until must include a timezone")
    if since and until and since > until:
        raise HTTPException(status_code=422, detail="since must not be after until")

    filters = [ProductEvent.user_id == user_id]
    if since:
        filters.append(ProductEvent.occurred_at >= since)
    if until:
        filters.append(ProductEvent.occurred_at <= until)

    rows = (
        await db.execute(
            select(ProductEvent.event_name, func.count(ProductEvent.event_id))
            .where(*filters)
            .group_by(ProductEvent.event_name)
            .order_by(ProductEvent.event_name)
        )
    ).all()
    counts = {name: count for name, count in rows}
    total = sum(counts.values())
    return {
        "evidence_status": "verified_persisted_events" if total else "no_verified_events",
        "total_events": total,
        "event_counts": counts,
        "scope": "authenticated_user",
        "since": since,
        "until": until,
    }
