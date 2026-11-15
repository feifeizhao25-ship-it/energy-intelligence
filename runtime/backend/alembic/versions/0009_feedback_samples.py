"""Shared feedback samples mirrored from the jsonl volume.

Revision ID: 0009_feedback_samples
Revises: 0008_product_alerts
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0009_feedback_samples"
down_revision: Union[str, None] = "0008_product_alerts"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "feedback_samples",
        sa.Column("id", sa.String(length=80), primary_key=True),
        sa.Column("kind", sa.String(length=40), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("feedback_samples")
