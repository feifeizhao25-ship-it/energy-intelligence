"""
报告中心服务
"""
from typing import Optional, List, Dict, Union
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

from app.models.report import Report
from app.models.project import Project
from app.schemas.report import (
    ReportCreate,
    ReportResponse,
    ReportList,
    ReportType,
    ReportCategory,
    ReportStatus,
)


class ReportService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_reports(
        self,
        user_id: str,
        page: int = 1,
        page_size: int = 20,
        project_id: Optional[UUID] = None,
        category: Optional[ReportCategory] = None,
        report_type: Optional[ReportType] = None,
        status: Optional[ReportStatus] = None,
    ) -> ReportList:
        """获取报告列表"""
        query = select(Report).where(Report.user_id == user_id)
        
        if project_id:
            query = query.where(Report.project_id == project_id)
        if category:
            query = query.where(Report.category == category)
        if report_type:
            query = query.where(Report.type == report_type)
        if status:
            query = query.where(Report.status == status)
        
        # 计算总数
        count_query = select(func.count()).select_from(query.subquery())
        total = await self.db.scalar(count_query)
        
        # 分页查询
        query = query.order_by(Report.created_at.desc())
        query = query.offset((page - 1) * page_size).limit(page_size)
        
        result = await self.db.execute(query)
        items = result.scalars().all()
        
        # 获取项目名称
        items_with_name = []
        for item in items:
            project = await self.db.get(Project, item.project_id)
            data = ReportResponse.model_validate(item)
            data.project_name = project.name if project else None
            items_with_name.append(data)
        
        return ReportList(
            items=items_with_name,
            total=total,
            page=page,
            page_size=page_size,
        )

    async def create_report(
        self,
        user_id: str,
        data: ReportCreate,
    ) -> ReportResponse:
        """创建报告"""
        report = Report(
            user_id=user_id,
            project_id=data.project_id,
            title=data.title,
            type=data.type,
            category=data.category,
            status=ReportStatus.GENERATING,
            progress=0,
            notes=data.notes,
        )
        
        self.db.add(report)
        await self.db.commit()
        await self.db.refresh(report)
        
        response = ReportResponse.model_validate(report)
        project = await self.db.get(Project, report.project_id)
        response.project_name = project.name if project else None
        return response

    async def generate_report_async(self, report_id: str):
        """异步生成报告"""
        import asyncio
        from datetime import datetime
        
        report = await self.db.get(Report, report_id)
        if not report:
            return
        
        # 模拟生成过程
        for progress in [25, 50, 75, 100]:
            await asyncio.sleep(1)  # 模拟耗时操作
            report.progress = progress
            await self.db.commit()
        
        report.status = ReportStatus.COMPLETED
        report.progress = 100
        report.completed_at = datetime.utcnow()
        report.size = 1024 * 1024 * 2  # 模拟2MB
        await self.db.commit()

    async def get_report(
        self,
        report_id: str,
        user_id: str,
    ) -> Optional[ReportResponse]:
        """获取报告详情"""
        result = await self.db.execute(
            select(Report).where(
                and_(
                    Report.id == report_id,
                    Report.user_id == user_id,
                )
            )
        )
        report = result.scalar_one_or_none()
        
        if not report:
            return None
        
        response = ReportResponse.model_validate(report)
        project = await self.db.get(Project, report.project_id)
        response.project_name = project.name if project else None
        return response

    async def get_download_url(
        self,
        report_id: str,
        user_id: str,
    ) -> Optional[dict]:
        """获取下载链接"""
        result = await self.db.execute(
            select(Report).where(
                and_(
                    Report.id == report_id,
                    Report.user_id == user_id,
                    Report.status == ReportStatus.COMPLETED,
                )
            )
        )
        report = result.scalar_one_or_none()
        
        if not report:
            return None
        
        # 实际项目中生成OSS预签名URL
        return {
            "download_url": f"https://example.com/reports/{report_id}.{report.type}",
            "expires_in": 3600,
        }

    async def delete_report(
        self,
        report_id: str,
        user_id: str,
    ) -> bool:
        """删除报告"""
        result = await self.db.execute(
            select(Report).where(
                and_(
                    Report.id == report_id,
                    Report.user_id == user_id,
                )
            )
        )
        report = result.scalar_one_or_none()
        
        if not report:
            return False
        
        await self.db.delete(report)
        await self.db.commit()
        return True

    async def create_share_link(
        self,
        report_id: str,
        user_id: str,
        expires_in: int,
    ) -> Optional[dict]:
        """创建分享链接"""
        result = await self.db.execute(
            select(Report).where(
                and_(
                    Report.id == report_id,
                    Report.user_id == user_id,
                    Report.status == ReportStatus.COMPLETED,
                )
            )
        )
        report = result.scalar_one_or_none()
        
        if not report:
            return None
        
        # 实际项目中生成带签名的分享链接
        return {
            "share_url": f"https://example.com/s/r/{report_id}",
            "expires_in": expires_in,
        }
