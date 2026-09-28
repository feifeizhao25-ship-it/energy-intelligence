"""Persist domestic membership expiry without inventing historical periods."""
from alembic import op
import sqlalchemy as sa

revision = "0005_subscription_expiry"
down_revision = "0004_payment_orders"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("users", sa.Column("subscription_expires_at", sa.DateTime(timezone=True), nullable=True))


def downgrade():
    op.drop_column("users", "subscription_expires_at")
