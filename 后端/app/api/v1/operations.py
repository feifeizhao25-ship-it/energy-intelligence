"""Operations API — asset health diagnostics, alerts, cleaning schedule."""
import uuid
import math
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user_id
from app.models.database import Project
from app.utils.financial_utils import calc_optimal_cleaning_interval

router = APIRouter(prefix="/operations")


# ── Shared mock generator (until IoT/SCADA integration) ──────────────────────
def _mock_health_data(project_id: str) -> dict:
    """Generate deterministic mock health data based on project_id hash."""
    seed = sum(ord(c) for c in project_id) % 100
    overall = 65 + (seed % 30)  # 65–94
    return {
        "overall_score": round(overall, 1),
        "status": "excellent" if overall >= 90 else "good" if overall >= 75 else "fair" if overall >= 60 else "poor",
        "dimensions": {
            "generation":   round(overall - 2 + (seed % 8), 1),
            "equipment":    round(overall + 1 - (seed % 6), 1),
            "availability": round(min(99.5, overall + 3), 1),
            "pr_ratio":     round(overall - 4 + (seed % 5), 1),
        },
        "findings": [
            {
                "id": "f001",
                "category": "Soiling",
                "description": "Estimated 4.2% generation loss due to soiling accumulation on panel surfaces.",
                "severity": "medium",
                "estimated_loss": round(1800 + seed * 120, 2),
            },
            {
                "id": "f002",
                "category": "Inverter",
                "description": f"Inverter unit INV-{seed % 4 + 1:02d} showing elevated temperature (78°C vs 70°C baseline).",
                "severity": "low" if seed < 50 else "high",
                "estimated_loss": round(600 + seed * 40, 2),
            },
            {
                "id": "f003",
                "category": "String Mismatch",
                "description": "String S-07 underperforming by 8.3% relative to adjacent strings.",
                "severity": "medium",
                "estimated_loss": round(900 + seed * 30, 2),
            },
        ],
        "recommendations": [
            {
                "title": "Schedule Emergency Cleaning",
                "description": "Deploy cleaning crew within 7 days to address soiling loss.",
                "priority": "high",
                "benefit": "Recover 4.2% generation — approx. $1,800/month",
                "estimated_roi": "820%",
                "timeframe": "Within 7 days",
            },
            {
                "title": "Inverter Thermal Inspection",
                "description": f"Inspect and clean cooling system on INV-{seed % 4 + 1:02d}. Check fan operation.",
                "priority": "medium",
                "benefit": "Prevent unplanned downtime and extend inverter life by 3+ years",
                "estimated_roi": "340%",
                "timeframe": "Within 30 days",
            },
            {
                "title": "String-Level IV Curve Tracing",
                "description": "Perform I-V curve tracing on string S-07 to identify shading, cell degradation or bypass diode failure.",
                "priority": "low",
                "benefit": "Recover 8.3% output on affected string",
                "estimated_roi": "180%",
                "timeframe": "Within 90 days",
            },
        ],
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


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
    return _mock_health_data(project_id)


# ── GET /operations/alerts ─────────────────────────────────────────────────────
@router.get("/alerts")
async def list_alerts(
    unread_only: bool = Query(False),
    severity: Optional[str] = Query(None, pattern="^(info|warning|critical)$"),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Return operational alerts for the current user."""
    # Mock alert data (replace with DB query when alert ingestion pipeline exists)
    all_alerts = [
        {
            "id": "alert-001",
            "title": "Inverter Overtemperature",
            "message": "INV-03 temperature exceeded 80°C threshold at 14:32 UTC.",
            "severity": "critical",
            "is_read": False,
            "project_id": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
        {
            "id": "alert-002",
            "title": "Soiling Rate Above Threshold",
            "message": "Daily soiling rate reached 0.35% — cleaning recommended within 5 days.",
            "severity": "warning",
            "is_read": False,
            "project_id": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
        {
            "id": "alert-003",
            "title": "Grid Curtailment Event",
            "message": "14.2 MWh curtailed between 11:00–13:30 UTC per grid operator request.",
            "severity": "info",
            "is_read": True,
            "project_id": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
    ]

    if unread_only:
        all_alerts = [a for a in all_alerts if not a["is_read"]]
    if severity:
        all_alerts = [a for a in all_alerts if a["severity"] == severity]

    return all_alerts


# ── PATCH /operations/alerts/{alert_id}/read ───────────────────────────────────
@router.patch("/alerts/{alert_id}/read")
async def mark_alert_read(
    alert_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """Mark a specific alert as read."""
    # When real DB is integrated: UPDATE alerts SET is_read=true WHERE id=alert_id AND user_id=user_id
    return {
        "id": alert_id,
        "is_read": True,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


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

    capacity_mw = project.capacity_mw or 10.0
    return {
        "project_id": project_id,
        "capacity_mw": capacity_mw,
        "daily_generation_mwh": round(capacity_mw * 5.8, 1),
        "monthly_generation_mwh": round(capacity_mw * 5.8 * 30, 1),
        "capacity_factor": 0.215,
        "performance_ratio": 0.823,
        "availability": 0.981,
        "specific_yield_kwh_kwp": round(5.8 * 30, 1),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
