"""Admin dashboard completion: campaign audience, branch availability, audit detail.

Revision ID: 0003_dashboard_completion
Revises: 0002_admin_dashboard
"""
from alembic import op
import sqlalchemy as sa

revision = "0003_dashboard_completion"
down_revision = "0002_admin_dashboard"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "campaigns",
        sa.Column("audience", sa.String(length=32), nullable=False, server_default="Everyone"),
    )
    op.add_column(
        "service_branch_prices",
        sa.Column("is_available", sa.Boolean(), nullable=False, server_default=sa.text("1")),
    )
    op.add_column("audit_logs", sa.Column("detail", sa.String(length=600), nullable=True))


def downgrade() -> None:
    op.drop_column("audit_logs", "detail")
    op.drop_column("service_branch_prices", "is_available")
    op.drop_column("campaigns", "audience")
