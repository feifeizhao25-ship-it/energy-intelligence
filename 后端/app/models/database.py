"""
SQLAlchemy ORM models for Energy Intelligence Platform.
"""

from sqlalchemy import Column, String, Integer, Float, DateTime, Boolean, Text, ForeignKey, Index
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime, timezone

Base = declarative_base()


class Project(Base):
    __tablename__ = "projects"

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    technology = Column(String(50))  # solar, wind, hybrid
    location = Column(String(255))
    latitude = Column(Float)
    longitude = Column(Float)
    capacity_mw = Column(Float)
    status = Column(String(50), default="draft")
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    owner = relationship("User", back_populates="projects")
    resources = relationship("ResourceAssessment", back_populates="project")
    financial_models = relationship("FinancialModel", back_populates="project")


class ResourceAssessment(Base):
    __tablename__ = "resource_assessments"

    id = Column(String(36), primary_key=True)
    project_id = Column(String(36), ForeignKey("projects.id"), nullable=False, index=True)
    technology = Column(String(50))  # solar, wind
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    data_source = Column(String(50))
    ghi = Column(Float)  # W/m2
    dni = Column(Float)
    dhi = Column(Float)
    wind_speed = Column(Float)
    resource_class = Column(String(10))
    score = Column(Float)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    project = relationship("Project", back_populates="resources")


class FinancialModel(Base):
    __tablename__ = "financial_models"

    id = Column(String(36), primary_key=True)
    project_id = Column(String(36), ForeignKey("projects.id"), nullable=False, index=True)
    scenario_name = Column(String(255))
    capacity_mw = Column(Float)
    capex_per_w = Column(Float)
    opex_per_kw_yr = Column(Float)
    electricity_price = Column(Float)
    irr = Column(Float)
    npv = Column(Float)
    lcoe = Column(Float)
    payback_years = Column(Float)
    capacity_factor = Column(Float)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    project = relationship("Project", back_populates="financial_models")


class ConsentRecord(Base):
    __tablename__ = "consent_records"

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    marketing = Column(Boolean, default=False)
    analytics = Column(Boolean, default=True)
    third_party = Column(Boolean, default=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    __table_args__ = (Index("idx_user_consent", "user_id"),)
