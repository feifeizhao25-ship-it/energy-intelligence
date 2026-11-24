"""Team seats for the signed-in account. No sample members."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user_id
from app.models.user import User
from app.services import team_workspace

router = APIRouter(prefix="/team")


class InviteIn(BaseModel):
    member_id: str = Field(min_length=1, max_length=80)
    role: str = "member"


class RemoveIn(BaseModel):
    member_id: str


async def _actor(user_id: str, db: AsyncSession) -> tuple[str, str]:
    user = await db.get(User, user_id)
    plan = (user.plan if user else None) or "free"
    label = (user.name if user and user.name else "") or "账户所有者"
    return plan, label


@router.get("")
async def get_team(user_id: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    plan, label = await _actor(user_id, db)
    return team_workspace.view(user_id, plan, label)


@router.post("/invite")
async def post_invite(body: InviteIn, user_id: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    plan, label = await _actor(user_id, db)
    return team_workspace.invite(user_id, plan, body.member_id, body.role, label)


@router.post("/remove")
async def post_remove(body: RemoveIn, user_id: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    plan, label = await _actor(user_id, db)
    return team_workspace.remove(user_id, plan, body.member_id, label)
