"""Add signup_source_events (国内版注册来源题，新增表，不改已有表).

Revision ID: 0011_signup_source_events
Revises: 0010_project_country_code
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0011_signup_source_events"
down_revision: Union[str, None] = "0010_project_country_code"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "signup_source_events",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("source", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_signup_source_events_user_id", "signup_source_events", ["user_id"], unique=True)
    op.create_index("ix_signup_source_events_source_created_at", "signup_source_events", ["source", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_signup_source_events_source_created_at", table_name="signup_source_events")
    op.drop_index("ix_signup_source_events_user_id", table_name="signup_source_events")
    op.drop_table("signup_source_events")
