"""现金流预测模型（reports 路由读取最新一条用于财务指标）。"""

from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Float, ForeignKey, String
from sqlalchemy.types import JSON

from app.models.database import Base


class CashflowProjection(Base):
    __tablename__ = "cashflow_projections"

    id = Column(String(36), primary_key=True)
    project_id = Column(String(36), ForeignKey("projects.id"), nullable=False, index=True)
    scenario_name = Column(String(255))
    yearly_cashflows = Column(JSON)
    irr = Column(Float)
    npv = Column(Float)
    lcoe = Column(Float)
    payback_years = Column(Float)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
