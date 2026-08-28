import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user_id
from app.models.database import ResourceAssessment, Project
from app.schemas.resource import (
    SolarResourceRequest, SolarResourceResponse,
    WindResourceRequest, WindResourceResponse,
)
from app.services.resource_service import fetch_solar_resource, fetch_wind_resource

router = APIRouter(prefix="/resource")


async def _owned_project_id(
    project_id: str | None,
    user_id: str,
    db: AsyncSession,
) -> str | None:
    """Return an owned project id, or keep an ad-hoc lookup ephemeral."""
    if not project_id:
        return None
    result = await db.execute(
        select(Project.id).where(Project.id == project_id, Project.user_id == user_id)
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Project not found or access denied")
    return project_id


@router.post("/solar", response_model=SolarResourceResponse)
async def solar_resource(
    body: SolarResourceRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Assess solar resource and save to database."""
    result = await fetch_solar_resource(body)
    project_id = await _owned_project_id(body.project_id, user_id, db)
    if project_id:
        db.add(ResourceAssessment(
            id=str(uuid.uuid4()), project_id=project_id, technology="solar",
            latitude=body.lat, longitude=body.lng, data_source=result.data_source,
            ghi=result.ghi, dni=result.dni, dhi=result.dhi, wind_speed=None,
            resource_class=result.resource_class, score=result.score,
            created_at=datetime.now(timezone.utc),
        ))
        await db.flush()
    return result


@router.post("/wind", response_model=WindResourceResponse)
async def wind_resource(
    body: WindResourceRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Assess wind resource and save to database."""
    result = await fetch_wind_resource(body)
    project_id = await _owned_project_id(body.project_id, user_id, db)
    if project_id:
        db.add(ResourceAssessment(
            id=str(uuid.uuid4()), project_id=project_id, technology="wind",
            latitude=body.lat, longitude=body.lng, data_source="open_meteo",
            ghi=None, dni=None, dhi=None, wind_speed=result.mean_speed,
            resource_class=result.resource_class, score=result.score,
            created_at=datetime.now(timezone.utc),
        ))
        await db.flush()
    return result


@router.get("/{assessment_id}")
async def get_resource_assessment(
    assessment_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get saved resource assessment from database."""
    result = await db.execute(
        select(ResourceAssessment).where(ResourceAssessment.id == assessment_id)
    )
    assessment = result.scalar_one_or_none()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    proj_result = await db.execute(
        select(Project.id).where(Project.id == assessment.project_id, Project.user_id == user_id)
    )
    if proj_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Assessment not found")

    return {
        "id": assessment.id,
        "project_id": assessment.project_id,
        "technology": assessment.technology,
        "latitude": assessment.latitude,
        "longitude": assessment.longitude,
        "ghi": assessment.ghi,
        "dni": assessment.dni,
        "dhi": assessment.dhi,
        "wind_speed": assessment.wind_speed,
        "resource_class": assessment.resource_class,
        "score": assessment.score,
        "data_source": assessment.data_source,
        "created_at": assessment.created_at.isoformat() if assessment.created_at else None,
    }
