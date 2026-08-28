"""Operations API — asset health diagnostics, alerts, cleaning schedule."""
import math
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user_id
from app.models.database import Project
from app.utils.financial_utils import calc_optimal_cleaning_interval

router = APIRouter(prefix="/operations")


class CleaningCalculationRequest(BaseModel):
    cleaning_cost_usd: float = Field(..., gt=0)
    daily_revenue_usd: float = Field(..., gt=0)
    soiling_rate_fraction_per_day: float = Field(..., gt=0, le=0.10)


@router.post("/cleaning/calculate")
async def calculate_cleaning_schedule(
    body: CleaningCalculationRequest,
    user_id: str = Depends(get_current_user_id),
):
    """Auditable economic interval based only on explicit user assumptions."""
    optimal_interval = calc_optimal_cleaning_interval(
        body.cleaning_cost_usd,
        body.daily_revenue_usd,
        body.soiling_rate_fraction_per_day * 100,
    )
    annual_cleanings = max(1, round(365 / optimal_interval))
    daily_loss = body.daily_revenue_usd * body.soiling_rate_fraction_per_day
    loss_per_cycle = daily_loss * optimal_interval * (optimal_interval + 1) / 2
    annual_cleaning_cost = annual_cleanings * body.cleaning_cost_usd
    annual_soiling_loss = annual_cleanings * loss_per_cycle
    theoretical_interval = math.sqrt(
        2 * body.cleaning_cost_usd
        / (body.daily_revenue_usd * body.soiling_rate_fraction_per_day)
    )
    scenarios = []
    for interval in sorted({7, 14, 30, optimal_interval}):
        cleanings = max(1, round(365 / interval))
        soiling_loss = cleanings * daily_loss * interval * (interval + 1) / 2
        scenarios.append({
            "days": interval,
            "total": round(cleanings * body.cleaning_cost_usd + soiling_loss, 2),
        })
    return {
        "optimal_interval_days": optimal_interval,
        "theoretical_interval_days": round(theoretical_interval, 4),
        "annual_cleanings": annual_cleanings,
        "annual_cleaning_cost": round(annual_cleaning_cost, 2),
        "annual_soiling_loss": round(annual_soiling_loss, 2),
        "total_annual_cost": round(annual_cleaning_cost + annual_soiling_loss, 2),
        "scenarios": scenarios,
        "model_version": "cleaning-economic-interval-v1.0",
        "formula": "N* = sqrt(2C / (R_daily * s_fraction))",
        "assumptions": {
            "source": "user_input",
            **body.model_dump(),
        },
    }


def _operations_source_unavailable() -> None:
    """Fail closed until an authorised SCADA/IoT ingestion source is configured."""
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail=(
            "实时运维数据源尚未配置。请接入经过授权的 SCADA/IoT 数据源后重试；"
            "系统不会返回模拟健康分、告警、发电量或设备状态。"
        ),
    )


# ── GET /operations/health/{project_id} ───────────────────────────────────────
@router.get("/health/{project_id}")
async def get_project_health(
    project_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Return health score and diagnostic report for a project."""
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.user_id == user_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    _operations_source_unavailable()


# ── GET /operations/alerts ─────────────────────────────────────────────────────
@router.get("/alerts")
async def list_alerts(
    unread_only: bool = Query(False),
    severity: Optional[str] = Query(None, pattern="^(info|warning|critical)$"),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Return operational alerts for the current user."""
    _operations_source_unavailable()


# ── PATCH /operations/alerts/{alert_id}/read ───────────────────────────────────
@router.patch("/alerts/{alert_id}/read")
async def mark_alert_read(
    alert_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """Mark a specific alert as read."""
    _operations_source_unavailable()


# ── GET /operations/cleaning/{project_id} ─────────────────────────────────────
@router.get("/cleaning/{project_id}")
async def get_cleaning_schedule(
    project_id: str,
    cleaning_cost_usd: float = Query(2500.0, description="Cost per cleaning event (USD)"),
    soiling_loss_rate: float = Query(0.002, description="Daily generation loss from soiling (fraction)"),
    revenue_per_mwh: float = Query(55.0, description="PPA or market price (USD/MWh)"),
    annual_gen_mwh: float = Query(60000.0, description="Annual generation (MWh)"),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Calculate optimal cleaning schedule using:
    N* = sqrt(2C / (Rs * soiling_rate_per_day))
    where C = cleaning cost, Rs = daily revenue loss per unit soiling.
    """
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.user_id == user_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    daily_gen_mwh = annual_gen_mwh / 365.0
    daily_revenue = daily_gen_mwh * revenue_per_mwh
    daily_loss_usd = daily_revenue * soiling_loss_rate

    # N* = sqrt(2C / daily_loss_usd)
    if daily_loss_usd <= 0:
        optimal_interval = 90
    else:
        optimal_interval = round(math.sqrt(2 * cleaning_cost_usd / daily_loss_usd))

    annual_cleanings = max(1, round(365 / optimal_interval))
    cleaning_cost_annual = annual_cleanings * cleaning_cost_usd
    revenue_protected = daily_loss_usd * optimal_interval * annual_cleanings
    net_benefit = revenue_protected - cleaning_cost_annual

    return {
        "optimal_interval_days": optimal_interval,
        "annual_cleanings": annual_cleanings,
        "cleaning_cost_annual": round(cleaning_cost_annual, 2),
        "revenue_protected": round(revenue_protected, 2),
        "net_benefit": round(net_benefit, 2),
        "formula_used": "N* = sqrt(2C / (Rs * soiling_rate))",
        "inputs": {
            "cleaning_cost_usd": cleaning_cost_usd,
            "soiling_loss_rate_per_day": soiling_loss_rate,
            "revenue_per_mwh": revenue_per_mwh,
            "annual_gen_mwh": annual_gen_mwh,
        },
    }


# ── GET /operations/performance/{project_id} ───────────────────────────────────
@router.get("/performance/{project_id}")
async def get_performance(
    project_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Return real-time performance metrics."""
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.user_id == user_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    _operations_source_unavailable()
