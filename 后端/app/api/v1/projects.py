"""Projects API — full CRUD with SQLAlchemy async queries."""
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user_id
from app.models.database import Project
from app.schemas.project import ProjectCreate, ProjectResponse, ProjectUpdate

router = APIRouter(prefix="/projects")


# ── Helper ─────────────────────────────────────────────────────────────────────
async def _get_project_or_404(project_id: str, user_id: str, db: AsyncSession) -> Project:
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.user_id == user_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found or access denied",
        )
    return project


# ── GET /projects ──────────────────────────────────────────────────────────────
@router.get("", response_model=List[ProjectResponse])
async def list_projects(
    technology: Optional[str] = Query(None, pattern="^(solar|wind|hybrid|storage)$"),
    project_status: Optional[str] = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """List projects belonging to the current user with optional filters."""
    stmt = select(Project).where(Project.user_id == user_id)

    if technology:
        stmt = stmt.where(Project.technology == technology)
    if project_status:
        stmt = stmt.where(Project.status == project_status)

    stmt = stmt.order_by(Project.updated_at.desc())
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(stmt)
    return result.scalars().all()


# ── POST /projects ─────────────────────────────────────────────────────────────
@router.post("", response_model=ProjectResponse, status_code=201)
async def create_project(
    body: ProjectCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Create a new project for the authenticated user."""
    now = datetime.now(timezone.utc)
    project = Project(
        id=str(uuid.uuid4()),
        user_id=user_id,
        name=body.name,
        description=body.description,
        technology=body.technology,
        location=body.location,
        latitude=body.latitude,
        longitude=body.longitude,
        capacity_mw=body.capacity_mw,
        status="draft",
        created_at=now,
        updated_at=now,
    )
    db.add(project)
    await db.flush()
    await db.refresh(project)
    return project


# ── GET /projects/{project_id} ─────────────────────────────────────────────────
@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific project by ID (must belong to current user)."""
    return await _get_project_or_404(project_id, user_id, db)


# ── PATCH /projects/{project_id} ───────────────────────────────────────────────
@router.patch("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: str,
    body: ProjectUpdate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Update mutable project fields."""
    await _get_project_or_404(project_id, user_id, db)  # ownership check

    update_data = body.model_dump(exclude_unset=True)
    if not update_data:
        return await _get_project_or_404(project_id, user_id, db)

    await db.execute(
        update(Project)
        .where(Project.id == project_id, Project.user_id == user_id)
        .values(**update_data, updated_at=datetime.now(timezone.utc))
    )
    await db.flush()
    return await _get_project_or_404(project_id, user_id, db)


# ── DELETE /projects/{project_id} ──────────────────────────────────────────────
@router.delete("/{project_id}", status_code=204)
async def delete_project(
    project_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Permanently delete a project (cascades to assessments, models, alerts)."""
    await _get_project_or_404(project_id, user_id, db)  # ownership check
    await db.execute(
        delete(Project).where(Project.id == project_id, Project.user_id == user_id)
    )
