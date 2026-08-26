"""定制报告申请 API（POST /api/v1/reports/custom）。

合规要点（运营资料硬要求）：
- 校验项目归属（非本人项目 404）；
- 校验 export_formats 权益（free 仅 pdf；docx/api 越权抛 QuotaExceeded → 429）；
- 创建 Report 记录固定 is_premium=True、reviewed=False，状态 pending_review；
- 返回 202 + 「人工终审后发布」说明文案 — 定制报告未经人工终审不对外发布。
"""

from typing import List, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user_id
from app.core.subscription import assert_entitlement
from app.models.database import Project
from app.models.user import User
from app.models.report import Report

router = APIRouter(prefix="/reports", tags=["定制报告"])

VALID_FORMATS = ("pdf", "docx", "api")

REVIEW_NOTICE = "定制报告已受理，人工终审后发布"


class CustomReportRequest(BaseModel):
    project_id: str = Field(..., min_length=1)
    format: str = Field("pdf", description="导出格式：pdf | docx | api")
    title: Optional[str] = Field(None, max_length=255)
    sections: Optional[List[str]] = None
    language: str = Field("zh", description="报告语言：zh | en")


@router.post("/custom", status_code=202)
async def create_custom_report(
    req: CustomReportRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    if req.format not in VALID_FORMATS:
        raise HTTPException(
            status_code=422,
            detail=f"不支持的导出格式: {req.format}（可选 {'/'.join(VALID_FORMATS)}）",
        )

    # 项目归属校验：不存在或不属于当前用户一律 404（不泄露他人项目存在性）
    result = await db.execute(
        select(Project).where(
            Project.id == req.project_id, Project.user_id == user_id
        )
    )
    project = result.scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    # export_formats 权益：free 仅 pdf，docx/api 越权 → QuotaExceeded（429）
    await assert_entitlement(user, f"export_formats:{req.format}", db)

    title = req.title or f"定制报告 — {project.name}"
    report = Report(
        id=str(uuid4()),
        project_id=project.id,
        user_id=user_id,
        report_type="custom",
        title=title,
        language=req.language,
        status="pending_review",
        content=None,
        data_sources={"format": req.format, "sections": req.sections or []},
        is_premium=True,
        reviewed=False,
    )
    db.add(report)
    await db.commit()

    return {
        "data": {
            "report_id": report.id,
            "project_id": project.id,
            "format": req.format,
            "status": "pending_review",
            "is_premium": True,
            "reviewed": False,
            "message": REVIEW_NOTICE,
        }
    }
