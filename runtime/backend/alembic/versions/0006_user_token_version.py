"""Token version for revoking JWTs after account deletion or password reset."""
from alembic import op
import sqlalchemy as sa

revision = "0006_user_token_version"
down_revision = "0005_subscription_expiry"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("users", sa.Column("token_version", sa.Integer(), nullable=False, server_default="0"))


def downgrade():
    op.drop_column("users", "token_version")
