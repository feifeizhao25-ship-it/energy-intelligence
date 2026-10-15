"""个人信息权利：导出我的数据 / 删除我的账号（PIPL 第 45、47 条；GDPR Art. 15、17、20）。

原实现依赖 Celery + SendGrid 异步发邮件、30 天后删除，但路由从未挂载、「撤销删除」是空实现，
法律页日期写死 2024-01-01。这里改为同步、可测试的实现：

- ``GET  /api/v1/privacy/export``：立即返回 JSON（可机读，满足可携带权）。
- ``POST /api/v1/privacy/delete-account``：body ``{"confirm": "DELETE"}``，立即删除个人数据与业务数据；
  支付订单按《电子商务法》第 31 条保存不少于三年，因此只保留订单并解除与个人身份的关联
  （账号行匿名化，不再含手机号/邮箱/姓名/公司）。
- ``GET/PUT /api/v1/privacy/consent``：同意偏好。
"""
import os
import secrets
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user_id
from app.models.alert import AlertRule
from app.models.cashflow import CashflowProjection
from app.models.database import ConsentRecord, FinancialModel, Project, ResourceAssessment
from app.models.payment_order import PaymentOrder
from app.models.report import Report
from app.models.user import User

router = APIRouter(prefix="/privacy")

ANONYMIZED_NAME = "已注销用户"


def _iso(value):
    return value.isoformat() if value else None


def _row(obj, fields):
    out = {}
    for f in fields:
        v = getattr(obj, f, None)
        out[f] = _iso(v) if isinstance(v, datetime) else (str(v) if v is not None and f == "amount_cny" else v)
    return out


async def _user_or_404(user_id: str, db: AsyncSession) -> User:
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if user is None or user.name == ANONYMIZED_NAME and not user.phone and not user.email:
        raise HTTPException(status_code=404, detail="用户不存在")
    return user


@router.get("/export")
async def export_my_data(user_id: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    user = await _user_or_404(user_id, db)
    projects = (await db.execute(select(Project).where(Project.user_id == user_id))).scalars().all()
    pids = [p.id for p in projects]

    async def _by_project(model):
        if not pids:
            return []
        return (await db.execute(select(model).where(model.project_id.in_(pids)))).scalars().all()

    consent = (await db.execute(select(ConsentRecord).where(ConsentRecord.user_id == user_id))).scalar_one_or_none()
    data = {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "format_version": 1,
        "user": _row(user, ["id", "name", "phone", "email", "company", "role", "country", "market",
                            "subscription_plan", "subscription_expires_at", "usage_quota", "created_at"]),
        "projects": [_row(p, ["id", "name", "technology", "capacity_mw", "status", "created_at"]) for p in projects],
        "resource_assessments": [_row(r, ["id", "project_id", "technology", "ghi", "wind_speed", "score", "created_at"])
                                 for r in await _by_project(ResourceAssessment)],
        "financial_models": [_row(m, ["id", "project_id", "scenario_name", "irr", "npv", "lcoe", "created_at"])
                             for m in await _by_project(FinancialModel)],
        "cashflow_projections": [_row(c, ["id", "project_id", "scenario_name", "irr", "npv", "lcoe", "payback_years", "created_at"])
                                 for c in await _by_project(CashflowProjection)],
        "reports": [_row(r, ["id", "project_id", "report_type", "title", "language", "status", "created_at"])
                    for r in (await db.execute(select(Report).where(Report.user_id == user_id))).scalars().all()],
        "alert_rules": [_row(a, ["id", "created_at"])
                        for a in (await db.execute(select(AlertRule).where(AlertRule.user_id == user_id))).scalars().all()],
        "payment_orders": [_row(o, ["order_no", "provider", "plan", "billing_period", "amount_cny", "status", "created_at", "paid_at"])
                           for o in (await db.execute(select(PaymentOrder).where(PaymentOrder.user_id == user_id))).scalars().all()],
        "consent": _row(consent, ["marketing", "analytics", "third_party", "updated_at"]) if consent else None,
    }
    return JSONResponse(data, headers={"Content-Disposition": f'attachment; filename="my-data-{user_id}.json"'})


class DeleteAccountRequest(BaseModel):
    confirm: str


def _remove_report_files(report_ids):
    from app.routers.reports import _existing_report_file

    for rid in report_ids:
        try:
            found = _existing_report_file(rid)
        except HTTPException:
            continue
        if found:
            try:
                os.remove(found[0])
            except OSError:
                pass


@router.post("/delete-account")
async def delete_my_account(
    body: DeleteAccountRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    if body.confirm != "DELETE":
        raise HTTPException(status_code=400, detail='请在请求中提交 {"confirm": "DELETE"} 以确认删除，删除后不可恢复')
    user = await _user_or_404(user_id, db)

    pids = (await db.execute(select(Project.id).where(Project.user_id == user_id))).scalars().all()
    report_ids = (await db.execute(select(Report.id).where(Report.user_id == user_id))).scalars().all()
    await db.execute(delete(Report).where(Report.user_id == user_id))
    if pids:
        for model in (ResourceAssessment, FinancialModel, CashflowProjection):
            await db.execute(delete(model).where(model.project_id.in_(pids)))
    await db.execute(delete(Project).where(Project.user_id == user_id))
    await db.execute(delete(AlertRule).where(AlertRule.user_id == user_id))
    await db.execute(delete(ConsentRecord).where(ConsentRecord.user_id == user_id))

    # 匿名化账号行：保留主键仅用于支付订单的法定留存关联
    user.name = ANONYMIZED_NAME
    user.phone = None
    user.email = None
    user.company = None
    user.country = None
    user.stripe_customer_id = None
    user.usage_quota = {}
    user.subscription_plan = "free"
    user.subscription_expires_at = None
    user.password_hash = "!deleted!" + secrets.token_hex(16)  # 不可能匹配任何密码
    await db.commit()
    _remove_report_files(report_ids)
    return {
        "deleted": True,
        "deleted_at": datetime.now(timezone.utc).isoformat(),
        "retained": ["payment_orders（《电子商务法》第31条：交易记录保存不少于三年，已与个人身份解除关联）"],
    }


class ConsentBody(BaseModel):
    marketing: bool = False
    analytics: bool = False
    third_party: bool = False


@router.get("/consent")
async def get_consent(user_id: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    consent = (await db.execute(select(ConsentRecord).where(ConsentRecord.user_id == user_id))).scalar_one_or_none()
    if not consent:
        # 默认不同意（PIPL/GDPR 要求同意须主动作出，不能默认勾选）
        return {"marketing": False, "analytics": False, "third_party": False, "updated_at": None}
    return _row(consent, ["marketing", "analytics", "third_party", "updated_at"])


@router.put("/consent")
async def update_consent(body: ConsentBody, user_id: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    consent = (await db.execute(select(ConsentRecord).where(ConsentRecord.user_id == user_id))).scalar_one_or_none()
    now = datetime.now(timezone.utc)
    if consent is None:
        consent = ConsentRecord(id=str(uuid.uuid4()), user_id=user_id)
        db.add(consent)
    consent.marketing, consent.analytics, consent.third_party = body.marketing, body.analytics, body.third_party
    consent.updated_at = now
    await db.commit()
    return {**body.model_dump(), "updated": True}
