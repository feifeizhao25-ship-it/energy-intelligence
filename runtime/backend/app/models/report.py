"""Report / Project / Cashflow 读取模型（reports 路由使用）。

Project 的权威定义在 app.models.database；本文件提供 Report 与
CashflowProjection，并保留 `app.models.project.Project` 兼容入口。
"""

from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, Column, DateTime, Float, ForeignKey, String, Text
from sqlalchemy.orm import relationship

from app.models.database import Base


class Report(Base):
    __tablename__ = "reports"

    id = Column(String(36), primary_key=True)
    project_id = Column(String(36), ForeignKey("projects.id"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    report_type = Column(String(50), nullable=False)
    title = Column(String(255))
    language = Column(String(10), default="zh")
    status = Column(String(50), default="completed")
    file_path = Column(String(512))
    content = Column(Text)
    # ── 合规列 (运营资料硬要求) ──
    data_sources = Column(JSON)                     # 数据溯源: {数据键: 来源标注}
    is_premium = Column(Boolean, default=False, nullable=False, server_default="0")
    reviewed = Column(Boolean, default=False, nullable=False, server_default="0")  # 人工终审标记
    reviewed_by = Column(String(36))                # 终审人 user id, 可空
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # 关系用于 ORM 写入排序（PostgreSQL 强外键下必须先插父行）
    project = relationship("Project")
    user = relationship("User")
