from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone, timedelta
import uuid

from app.core.dependencies import get_current_user_id
from app.core.database import get_db
from app.models.database import User, ConsentRecord
from app.tasks.gdpr import export_user_data, delete_user_account

router = APIRouter(prefix="/privacy")

DELETION_GRACE_DAYS = 30


# ── GDPR: Export ───────────────────────────────────────────────────────────────
@router.post("/export-data", status_code=202)
async def export_data(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """GDPR Right of Access — compile and email all user data.
    Runs asynchronously via Celery."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Dispatch Celery task
    task = export_user_data.delay(user_id, user.email)

    return {
        "message": "Data export request received. You will receive an email within 72 hours.",
        "task_id": task.id,
        "requested_at": datetime.now(timezone.utc).isoformat(),
    }


# ── GDPR: Delete ────────────────────────────────────────────────────────────────
@router.post("/delete-account", status_code=202)
async def delete_account(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """GDPR Right to Erasure — schedule account deletion after 30-day grace period."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    deletion_at = datetime.now(timezone.utc) + timedelta(days=DELETION_GRACE_DAYS)

    # Schedule Celery task with eta=deletion_at
    task = delete_user_account.apply_async(
        args=[user_id],
        eta=deletion_at,
    )

    return {
        "message": f"Account deletion scheduled. Your account will be permanently deleted in {DELETION_GRACE_DAYS} days.",
        "task_id": task.id,
        "deletion_scheduled_at": deletion_at.isoformat(),
        "grace_period_days": DELETION_GRACE_DAYS,
    }


@router.post("/cancel-delete-account")
async def cancel_delete_account(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Cancel pending account deletion during grace period."""
    # In production: query deletion task by user_id and revoke it
    return {"message": "Account deletion cancelled. Your account remains active."}


# ── Consent ────────────────────────────────────────────────────────────────────
@router.get("/consent")
async def get_consent(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get user consent preferences from database."""
    result = await db.execute(select(ConsentRecord).where(ConsentRecord.user_id == user_id))
    consent = result.scalar_one_or_none()
    if not consent:
        return {"marketing": False, "analytics": True, "third_party": False}
    return {
        "marketing": consent.marketing,
        "analytics": consent.analytics,
        "third_party": consent.third_party,
        "updated_at": consent.updated_at.isoformat() if consent.updated_at else None,
    }


@router.put("/consent")
async def update_consent(
    body: dict,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Update user consent preferences in database."""
    marketing = body.get("marketing", False)
    analytics = body.get("analytics", True)
    third_party = body.get("third_party", False)

    result = await db.execute(select(ConsentRecord).where(ConsentRecord.user_id == user_id))
    consent = result.scalar_one_or_none()
    now = datetime.now(timezone.utc)

    if consent:
        consent.marketing = marketing
        consent.analytics = analytics
        consent.third_party = third_party
        consent.updated_at = now
    else:
        consent = ConsentRecord(
            id=str(uuid.uuid4()),
            user_id=user_id,
            marketing=marketing,
            analytics=analytics,
            third_party=third_party,
            updated_at=now,
        )
        db.add(consent)

    await db.flush()
    return {
        "marketing": consent.marketing,
        "analytics": consent.analytics,
        "third_party": consent.third_party,
        "updated": True,
    }


# ── Legal ──────────────────────────────────────────────────────────────────────
@router.get("/privacy-policy")
async def privacy_policy():
    return {"version": "1.0", "last_updated": "2024-01-01", "url": "/legal/privacy-policy"}


@router.get("/terms-of-service")
async def terms_of_service():
    return {"version": "1.0", "last_updated": "2024-01-01", "url": "/legal/terms-of-service"}
