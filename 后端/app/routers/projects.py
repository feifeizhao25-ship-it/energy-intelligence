"""
Projects API — 红线测试（附录 D）契约版。

恢复说明：历史碎片中 app/api/v1/projects.py 的契约（裸 ProjectResponse、
capacity_mw、solar|wind|hybrid 枚举）与红线测试不符。本路由按测试的真实
契约重建：统一信封 {"code","message","data"}、capacity_kw、location 对象、
technology 自由文本（如 "crystalline"）。
"""

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user_id
from app.database import get_db
from app.models.database import Project
from app.utils.response import success

router = APIRouter(prefix="/projects")


class LocationIn(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    address: Optional[str] = None
    timezone: Optional[str] = None


class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    location: LocationIn
    capacity_kw: float = Field(..., gt=0)
    technology: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None

    @field_validator("name")
    @classmethod
    def no_raw_html(cls, v: str) -> str:
        # R7 红线：拒绝未转义的 HTML/脚本输入
        if "<" in v or ">" in v:
            raise ValueError("项目名称不允许包含 HTML 标签字符")
        return v


def _to_response(project: Project) -> Dict[str, Any]:
    return {
        "id": project.id,
        "name": project.name,
        "description": project.description,
        "technology": project.technology,
        "capacity_kw": (project.capacity_mw or 0) * 1000,
        "location": {
            "latitude": project.latitude,
            "longitude": project.longitude,
            "address": project.location,
        },
        "status": project.status,
        "created_at": project.created_at.isoformat() if project.created_at else None,
        "updated_at": project.updated_at.isoformat() if project.updated_at else None,
    }


async def _get_owned(project_id: str, user_id: str, db: AsyncSession) -> Project:
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.user_id == user_id)
    )
    project = result.scalar_one_or_none()
    if project is None:
        # R11 红线：他人项目一律 404，不暴露存在性
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.post("", status_code=201)
async def create_project(
    body: ProjectCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    project = Project(
        id=str(uuid.uuid4()),
        user_id=user_id,
        name=body.name,
        description=body.description,
        technology=body.technology,
        location=body.location.address,
        latitude=body.location.latitude,
        longitude=body.location.longitude,
        capacity_mw=body.capacity_kw / 1000,
        status="draft",
        created_at=now,
        updated_at=now,
    )
    db.add(project)
    await db.flush()
    await db.refresh(project)
    return success(data=_to_response(project), message="created")


@router.get("")
async def list_projects(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Project).where(Project.user_id == user_id).order_by(Project.created_at.desc())
    )
    projects: List[Project] = list(result.scalars().all())
    return success(data=[_to_response(p) for p in projects])


@router.get("/{project_id}")
async def get_project(
    project_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    project = await _get_owned(project_id, user_id, db)
    return success(data=_to_response(project))


@router.delete("/{project_id}")
async def delete_project(
    project_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    project = await _get_owned(project_id, user_id, db)
    await db.delete(project)
    return success(data={"id": project_id}, message="deleted")


@router.get("/{project_id}/assessments")
async def get_assessments(
    project_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """评估结果汇总。评估引擎未接入时返回空结果集，绝不编造数值。"""
    await _get_owned(project_id, user_id, db)
    return success(data={"project_id": project_id, "results": {}})
