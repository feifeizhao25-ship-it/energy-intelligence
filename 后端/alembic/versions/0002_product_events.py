"""Add persisted product events.

Revision ID: 0002_product_events
Revises: 0001_initial_schema
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002_product_events"
down_revision: Union[str, None] = "0001_initial_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "product_events",
        sa.Column("event_id", sa.String(36), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("workspace_id", sa.String(36), nullable=True),
        sa.Column("event_name", sa.String(64), nullable=False),
        sa.Column("market", sa.String(10), nullable=False),
        sa.Column("locale", sa.String(20), nullable=False),
        sa.Column("channel", sa.String(64), nullable=True),
        sa.Column("campaign", sa.String(128), nullable=True),
        sa.Column("experiment", sa.String(128), nullable=True),
        sa.Column("properties", sa.JSON(), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ingested_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "idx_product_events_user_occurred",
        "product_events",
        ["user_id", "occurred_at"],
    )
    op.create_index(
        "idx_product_events_name_occurred",
        "product_events",
        ["event_name", "occurred_at"],
    )


def downgrade() -> None:
    op.drop_index("idx_product_events_name_occurred", table_name="product_events")
    op.drop_index("idx_product_events_user_occurred", table_name="product_events")
    op.drop_table("product_events")
