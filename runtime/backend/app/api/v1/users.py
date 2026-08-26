"""Users API — profile read/update with real SQLAlchemy queries."""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user_id
from app.models.user import User
from app.schemas.user import UserResponse, UserUpdateRequest

router = APIRouter(prefix="/users")


# ── Helper ─────────────────────────────────────────────────────────────────────
async def _get_user_or_404(user_id: str, db: AsyncSession) -> User:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


# ── GET /users/me ──────────────────────────────────────────────────────────────
@router.get("/me", response_model=UserResponse)
async def get_current_user(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Return the authenticated user's profile."""
    return await _get_user_or_404(user_id, db)


# ── PATCH /users/me ────────────────────────────────────────────────────────────
@router.patch("/me", response_model=UserResponse)
async def update_current_user(
    body: UserUpdateRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Update mutable profile fields."""
    user = await _get_user_or_404(user_id, db)

    update_data = body.model_dump(exclude_unset=True)
    if not update_data:
        return user

    await db.execute(
        update(User)
        .where(User.id == user_id)
        .values(**update_data, updated_at=datetime.now(timezone.utc))
    )
    await db.flush()
    return await _get_user_or_404(user_id, db)


# ── GET /users/profile/{target_id} ─────────────────────────────────────────────
@router.get("/profile/{target_id}", response_model=UserResponse)
async def get_user_profile(
    target_id: str,
    _user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Return another user's public profile (requires auth)."""
    return await _get_user_or_404(target_id, db)
