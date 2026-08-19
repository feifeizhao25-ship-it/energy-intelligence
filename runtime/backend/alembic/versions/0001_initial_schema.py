"""Initial schema — aligned with ORM models

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-03-22 00:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "0001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')

    # ── users ─────────────────────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("email", sa.String(255), nullable=False, unique=True, index=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("company", sa.String(200), nullable=True),
        sa.Column("role", sa.String(50), nullable=True),
        sa.Column("country", sa.String(100), nullable=True),
        sa.Column("stripe_customer_id", sa.String(255), nullable=True),
        sa.Column("plan", sa.String(50), nullable=False, server_default="free"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("idx_users_email", "users", ["email"])

    # ── projects ──────────────────────────────────────────────────────────────
    op.create_table(
        "projects",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("technology", sa.String(50), nullable=True),
        sa.Column("location", sa.String(255), nullable=True),
        sa.Column("latitude", sa.Float, nullable=True),
        sa.Column("longitude", sa.Float, nullable=True),
        sa.Column("capacity_mw", sa.Float, nullable=True),
        sa.Column("status", sa.String(50), nullable=False, server_default="draft"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )

    # ── resource_assessments ──────────────────────────────────────────────────
    op.create_table(
        "resource_assessments",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("project_id", sa.String(36), sa.ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("technology", sa.String(50), nullable=True),
        sa.Column("latitude", sa.Float, nullable=False),
        sa.Column("longitude", sa.Float, nullable=False),
        sa.Column("data_source", sa.String(50), nullable=True),
        sa.Column("ghi", sa.Float, nullable=True),
        sa.Column("dni", sa.Float, nullable=True),
        sa.Column("dhi", sa.Float, nullable=True),
        sa.Column("wind_speed", sa.Float, nullable=True),
        sa.Column("resource_class", sa.String(10), nullable=True),
        sa.Column("score", sa.Float, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )

    # ── financial_models ──────────────────────────────────────────────────────
    op.create_table(
        "financial_models",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("project_id", sa.String(36), sa.ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("scenario_name", sa.String(255), nullable=True),
        sa.Column("capacity_mw", sa.Float, nullable=True),
        sa.Column("capex_per_w", sa.Float, nullable=True),
        sa.Column("opex_per_kw_yr", sa.Float, nullable=True),
        sa.Column("electricity_price", sa.Float, nullable=True),
        sa.Column("irr", sa.Float, nullable=True),
        sa.Column("npv", sa.Float, nullable=True),
        sa.Column("lcoe", sa.Float, nullable=True),
        sa.Column("payback_years", sa.Float, nullable=True),
        sa.Column("capacity_factor", sa.Float, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )

    # ── consent_records ───────────────────────────────────────────────────────
    op.create_table(
        "consent_records",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("marketing", sa.Boolean, nullable=True, server_default="false"),
        sa.Column("analytics", sa.Boolean, nullable=True, server_default="true"),
        sa.Column("third_party", sa.Boolean, nullable=True, server_default="false"),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("idx_user_consent", "consent_records", ["user_id"])


def downgrade() -> None:
    for table in ("consent_records", "financial_models", "resource_assessments", "projects", "users"):
        op.drop_table(table)
