"""已授权入库的运维遥测与阈值告警。没有行时接口保持不可用，不补模拟值。"""

from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Float, ForeignKey, String

from app.models.database import Base


class OperationSample(Base):
    __tablename__ = "operation_samples"

    id = Column(String(36), primary_key=True)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    point_id = Column(String(120), nullable=False)
    recorded_at = Column(DateTime(timezone=True), nullable=False)
    power_kw = Column(Float)
    energy_kwh = Column(Float)
    irradiance = Column(Float)
    alarm_code = Column(String(40), nullable=False, default="")
    source = Column(String(20), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))


class OperationAlarmRule(Base):
    __tablename__ = "operation_alarm_rules"

    id = Column(String(36), primary_key=True)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    metric = Column(String(40), nullable=False)
    operator = Column(String(20), nullable=False)
    threshold = Column(Float, nullable=False, default=0)
    severity = Column(String(20), nullable=False, default="warning")
    enabled = Column(String(5), nullable=False, default="true")


class OperationAlarmEvent(Base):
    __tablename__ = "operation_alarm_events"

    id = Column(String(36), primary_key=True)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    rule_id = Column(String(36), nullable=False)
    point_id = Column(String(120), nullable=False)
    severity = Column(String(20), nullable=False)
    message = Column(String(300), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    acknowledged_at = Column(DateTime(timezone=True))
