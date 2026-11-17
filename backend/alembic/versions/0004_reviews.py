"""Customer reviews and ratings for salons and services.

Revision ID: 0004_reviews
Revises: 0003_dashboard_completion
"""
from alembic import op
import sqlalchemy as sa

revision = "0004_reviews"
down_revision = "0003_dashboard_completion"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "reviews",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("salon_id", sa.Integer(), nullable=False),
        sa.Column("service_id", sa.Integer(), nullable=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=True),
        sa.Column("comment", sa.String(length=1000), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("(CURRENT_TIMESTAMP)")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("(CURRENT_TIMESTAMP)")),
        sa.CheckConstraint("rating >= 1 AND rating <= 5", name="ck_review_rating_range"),
        sa.ForeignKeyConstraint(["service_id"], ["services.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["salon_id"], ["salons.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "salon_id", name="uq_user_salon_review"),
    )
    op.create_index(op.f("ix_reviews_salon_id"), "reviews", ["salon_id"])
    op.create_index(op.f("ix_reviews_user_id"), "reviews", ["user_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_reviews_user_id"), table_name="reviews")
    op.drop_index(op.f("ix_reviews_salon_id"), table_name="reviews")
    op.drop_table("reviews")
