"""GDPR 隐私端点（恢复重建版）。

历史版本依赖 Celery 异步任务（app.tasks.gdpr）做导出与延迟删除，
但部署单元中并未安装/运行 Celery worker，端点实际不可用。
本版本改为同步实现：导出直接返回 JSON，删除在当前请求内按外键
顺序完成，语义与 GDPR「访问权 / 被遗忘权」一致。
"""

from datetime import datetime, timezone
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user_id
from app.core.database import get_db
from app.models.cashflow import CashflowProjection
from app.models.database import ConsentRecord, FinancialModel, Project, ResourceAssessment
from app.models.user import User
from app.models.report import Report

router = APIRouter(prefix="/privacy")


# ── GDPR: Export ───────────────────────────────────────────────────────────────
@router.get("/export-data")
async def export_data(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """GDPR Right of Access — 返回当前用户的全部数据（profile/projects/reports）。"""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    projects = (
        await db.execute(select(Project).where(Project.user_id == user_id))
    ).scalars().all()
    reports = (
        await db.execute(select(Report).where(Report.user_id == user_id))
    ).scalars().all()

    return {
        "profile": {
            "id": user.id,
            "phone": user.phone,
            "email": user.email,
            "name": user.name,
            "company": user.company,
            "country": user.country,
            "market": user.market,
            "subscription_plan": user.subscription_plan,
            "created_at": user.created_at.isoformat() if user.created_at else None,
        },
        "projects": [
            {
                "id": p.id,
                "name": p.name,
                "description": p.description,
                "technology": p.technology,
                "location": p.location,
                "capacity_mw": p.capacity_mw,
                "status": p.status,
                "created_at": p.created_at.isoformat() if p.created_at else None,
            }
            for p in projects
        ],
        "reports": [
            {
                "id": r.id,
                "project_id": r.project_id,
                "report_type": r.report_type,
                "title": r.title,
                "language": r.language,
                "status": r.status,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in reports
        ],
        "exported_at": datetime.now(timezone.utc).isoformat(),
    }


# ── GDPR: Delete ────────────────────────────────────────────────────────────────
@router.post("/delete-account")
async def delete_account(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """GDPR Right to Erasure — 立即删除当前用户及其项目/报告等关联数据。

    删除顺序按外键依赖：先删 projects 的子表（reports/cashflow/资源评估/
    财务模型），再删 projects 与 consent_records，最后删 user。
    """
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    project_ids = select(Project.id).where(Project.user_id == user_id).scalar_subquery()

    await db.execute(delete(Report).where(Report.user_id == user_id))
    await db.execute(delete(CashflowProjection).where(CashflowProjection.project_id.in_(project_ids)))
    await db.execute(delete(ResourceAssessment).where(ResourceAssessment.project_id.in_(project_ids)))
    await db.execute(delete(FinancialModel).where(FinancialModel.project_id.in_(project_ids)))
    await db.execute(delete(Project).where(Project.user_id == user_id))
    await db.execute(delete(ConsentRecord).where(ConsentRecord.user_id == user_id))
    await db.execute(delete(User).where(User.id == user_id))

    return {
        "deleted": True,
        "message": "Your account and all associated data have been permanently deleted.",
        "deleted_at": datetime.now(timezone.utc).isoformat(),
    }


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
