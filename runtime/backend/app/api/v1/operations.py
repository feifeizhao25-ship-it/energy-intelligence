"""Operations API — asset health diagnostics, alerts, cleaning schedule."""
import math
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user_id
from app.models.database import Project
from app.models.operation_telemetry import OperationAlarmEvent, OperationAlarmRule, OperationSample
from app.services.operation_ingest import parse_csv, parse_points, rule_matches
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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="项目不存在")
    rows = await _project_samples(db, project_id)
    if not rows:
        _operations_source_unavailable()
    latest = rows[-1]
    return {
        "project_id": project_id,
        "health_score": None,
        "sample_count": len(rows),
        "latest_power_kw": latest.power_kw,
        "note": "已入库遥测。没有单独定义的健康分公式，因此不返回分数。",
    }


# ── GET /operations/alerts ─────────────────────────────────────────────────────
@router.get("/alerts")
async def list_alerts(
    unread_only: bool = Query(False),
    severity: Optional[str] = Query(None, pattern="^(info|warning|critical)$"),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Return operational alerts for the current user."""
    project_ids = (await db.execute(select(Project.id).where(Project.user_id == user_id))).scalars().all()
    if not project_ids:
        _operations_source_unavailable()
    sample_count = (await db.execute(
        select(func.count()).select_from(OperationSample).where(OperationSample.project_id.in_(project_ids))
    )).scalar_one()
    if not sample_count:
        _operations_source_unavailable()
    events = (await db.execute(
        select(OperationAlarmEvent).where(OperationAlarmEvent.project_id.in_(project_ids))
    )).scalars().all()
    if unread_only:
        events = [event for event in events if event.acknowledged_at is None]
    if severity:
        events = [event for event in events if event.severity == severity]
    return {
        "alerts": [{
            "id": event.id,
            "project_id": event.project_id,
            "severity": event.severity,
            "message": event.message,
            "acknowledged_at": event.acknowledged_at.isoformat() if event.acknowledged_at else None,
        } for event in events],
        "note": "告警只来自已入库遥测越过阈值的记录。",
    }


# ── PATCH /operations/alerts/{alert_id}/read ───────────────────────────────────
@router.patch("/alerts/{alert_id}/read")
async def mark_alert_read(
    alert_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Mark a stored threshold alert as read. Missing telemetry stays unavailable."""
    event = (await db.execute(select(OperationAlarmEvent).where(OperationAlarmEvent.id == alert_id))).scalar_one_or_none()
    if not event:
        _operations_source_unavailable()
    project = (await db.execute(select(Project).where(Project.id == event.project_id, Project.user_id == user_id))).scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="告警不存在")
    event.acknowledged_at = datetime.now(timezone.utc)
    await db.commit()
    return {"id": event.id, "acknowledged_at": event.acknowledged_at.isoformat()}


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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="项目不存在")

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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="项目不存在")
    rows = await _project_samples(db, project_id)
    if not rows:
        _operations_source_unavailable()
    powers = [row.power_kw for row in rows if row.power_kw is not None]
    energy = sum(row.energy_kwh or 0 for row in rows)
    return {
        "project_id": project_id,
        "sample_count": len(rows),
        "energy_kwh": round(energy, 3),
        "max_power_kw": max(powers) if powers else None,
        "note": "只汇总已入库遥测，不外推发电量。",
    }


async def _project_samples(db: AsyncSession, project_id: str) -> list[OperationSample]:
    result = await db.execute(
        select(OperationSample).where(OperationSample.project_id == project_id).order_by(OperationSample.recorded_at)
    )
    return list(result.scalars().all())


class AlarmRuleBody(BaseModel):
    metric: str
    operator: str
    threshold: float = 0
    severity: str = "warning"


@router.post("/telemetry/{project_id}")
async def ingest_telemetry(
    project_id: str,
    request: Request,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    project = (await db.execute(select(Project).where(Project.id == project_id, Project.user_id == user_id))).scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    content_type = request.headers.get("content-type", "")
    try:
        if "text/csv" in content_type:
            points = parse_csv((await request.body()).decode())
        else:
            points = parse_points(await request.json())
    except (ValueError, UnicodeDecodeError) as exc:
        raise HTTPException(status_code=400, detail="遥测格式不正确") from exc
    rules = (await db.execute(select(OperationAlarmRule).where(OperationAlarmRule.project_id == project_id, OperationAlarmRule.enabled == "true"))).scalars().all()
    created = 0
    for point in points:
        db.add(OperationSample(id=str(uuid.uuid4()), project_id=project_id, **point))
        created += 1
        for rule in rules:
            if rule_matches({"metric": rule.metric, "operator": rule.operator, "threshold": rule.threshold}, point):
                db.add(OperationAlarmEvent(
                    id=str(uuid.uuid4()),
                    project_id=project_id,
                    rule_id=rule.id,
                    point_id=point["point_id"],
                    severity=rule.severity if rule.severity in {"info", "warning", "critical"} else "warning",
                    message=f"点 {point['point_id']} 越过已保存的阈值",
                ))
    await db.commit()
    return {"accepted": created, "note": "只保存本次提交的点。"}


@router.post("/alarms/rules/{project_id}")
async def create_alarm_rule(
    project_id: str,
    body: AlarmRuleBody,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    project = (await db.execute(select(Project).where(Project.id == project_id, Project.user_id == user_id))).scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    if body.metric not in {"power_kw", "irradiance", "alarm_code"} or body.operator not in {"gt", "lt", "present"}:
        raise HTTPException(status_code=400, detail="阈值指标或比较方式无效")
    rule = OperationAlarmRule(
        id=str(uuid.uuid4()), project_id=project_id, metric=body.metric, operator=body.operator,
        threshold=body.threshold, severity=body.severity if body.severity in {"info", "warning", "critical"} else "warning",
    )
    db.add(rule)
    await db.commit()
    return {"id": rule.id}
