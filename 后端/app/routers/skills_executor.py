"""Authenticated Skills discovery and synchronous execution API.

Async execution deliberately fails closed until a durable queue is configured;
process-local task dictionaries are not reliable in multi-instance production.
"""

from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user_id
from app.models.user import User
from app.schemas.common import SuccessResponse
from app.skills.base import SkillStatus
from app.skills.registry import get_registry
from app.utils.response import success

router = APIRouter(prefix="/skills", tags=["skills"])


class FrontendSkillExecuteRequest(BaseModel):
    skill_id: str
    parameters: Dict[str, Any] = Field(default_factory=dict)


@router.get("", response_model=SuccessResponse[dict])
async def list_skills(
    category: Optional[str] = Query(None),
    service: Optional[str] = Query(None),
    user_id: str = Depends(get_current_user_id),
):
    registry = get_registry()
    items = [meta.to_dict() for meta in registry.list_skills(category, service)]
    return success(
        data={
            "items": items,
            "total": len(items),
            "categories": registry.list_categories(),
            "services": registry.list_services(),
        }
    )


@router.get("/categories", response_model=SuccessResponse[dict])
async def list_categories(user_id: str = Depends(get_current_user_id)):
    registry = get_registry()
    categories = [
        {
            "category": category,
            "count": len(registry.list_skills(category=category)),
        }
        for category in registry.list_categories()
    ]
    return success(data={"categories": categories, "total_categories": len(categories)})


@router.post("/execute", response_model=SuccessResponse[dict])
async def execute_skill_compat(
    body: FrontendSkillExecuteRequest,
    async_exec: bool = Query(False, alias="async"),
    timeout: float = Query(60.0, ge=1.0, le=120.0),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    return await _execute(body.skill_id, body.parameters, user_id, db, async_exec, timeout)


@router.get("/{skill_id}/schema", response_model=SuccessResponse[dict])
async def get_skill_schema(
    skill_id: str,
    user_id: str = Depends(get_current_user_id),
):
    wrapper = get_registry().get(skill_id)
    if wrapper is None:
        raise HTTPException(status_code=404, detail=f"Skill '{skill_id}' not found")
    return success(data={"skill_id": skill_id, "schema": wrapper.get_schema()})


@router.post("/{skill_id}/execute", response_model=SuccessResponse[dict])
async def execute_skill(
    skill_id: str,
    params: Dict[str, Any],
    async_exec: bool = Query(False, alias="async"),
    timeout: float = Query(60.0, ge=1.0, le=120.0),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    return await _execute(skill_id, params, user_id, db, async_exec, timeout)


async def _execute(
    skill_id: str,
    params: Dict[str, Any],
    user_id: str,
    db: AsyncSession,
    async_exec: bool,
    timeout: float,
):
    registry = get_registry()
    if registry.get_meta(skill_id) is None:
        raise HTTPException(status_code=404, detail=f"Skill '{skill_id}' not found")
    if async_exec:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Durable asynchronous skill execution is not configured",
        )

    # Market comes from the authenticated account, never a caller-controlled payload
    # or header, so CN and Global parameter assumptions cannot be mixed by spoofing.
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    market = "global" if (user.market or "cn").lower() == "global" else "cn"
    safe_params = {**params, "market": market}
    result = await registry.execute(skill_id, safe_params, timeout=timeout)
    if result.get("status") != SkillStatus.COMPLETED.value:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "skill_id": skill_id,
                "error_code": result.get("error_code", "EXECUTION_ERROR"),
                "message": result.get("error", "Skill execution failed"),
            },
        )
    return success(data=result)


@router.get("/{skill_id}", response_model=SuccessResponse[dict])
async def get_skill_detail(
    skill_id: str,
    user_id: str = Depends(get_current_user_id),
):
    registry = get_registry()
    meta = registry.get_meta(skill_id)
    if meta is None:
        raise HTTPException(status_code=404, detail=f"Skill '{skill_id}' not found")
    wrapper = registry.get(skill_id)
    return success(data={**meta.to_dict(), "schema": wrapper.get_schema() if wrapper else {}})
