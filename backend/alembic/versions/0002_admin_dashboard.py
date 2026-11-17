"""Admin dashboard schema: media, campaigns, branch pricing, page content.

Revision ID: 0002_admin_dashboard
Revises: 0001_initial
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import sqlite

revision = "0002_admin_dashboard"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # New columns on existing catalog tables.
    op.add_column("salons", sa.Column("image_url", sa.String(length=500), nullable=True))
    op.add_column("services", sa.Column("image_url", sa.String(length=500), nullable=True))

    op.create_table(
        "media_files",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("original_name", sa.String(length=255), nullable=False),
        sa.Column("mime_type", sa.String(length=100), nullable=False),
        sa.Column("size", sa.Integer(), nullable=False),
        sa.Column("url", sa.String(length=500), nullable=False),
        sa.Column("category", sa.String(length=40), nullable=False, server_default="general"),
        sa.Column("uploaded_by", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("(CURRENT_TIMESTAMP)")),
        sa.ForeignKeyConstraint(["uploaded_by"], ["users.id"], ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "campaigns",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("subtitle", sa.String(length=300), nullable=True),
        sa.Column("description", sa.String(length=600), nullable=False),
        sa.Column("image_id", sa.Integer(), nullable=True),
        sa.Column("image_url", sa.String(length=500), nullable=True),
        sa.Column("cta_label", sa.String(length=80), nullable=False, server_default="Explore"),
        sa.Column("cta_url", sa.String(length=200), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("(CURRENT_TIMESTAMP)")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("(CURRENT_TIMESTAMP)")),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ),
        sa.ForeignKeyConstraint(["image_id"], ["media_files.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "service_branch_prices",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("service_id", sa.Integer(), nullable=False),
        sa.Column("salon_id", sa.Integer(), nullable=False),
        sa.Column("price", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("(CURRENT_TIMESTAMP)")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("(CURRENT_TIMESTAMP)")),
        sa.ForeignKeyConstraint(["service_id"], ["services.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["salon_id"], ["salons.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("service_id", "salon_id", name="uq_service_branch_price"),
    )

    op.create_table(
        "page_content",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("key", sa.String(length=160), nullable=False),
        sa.Column("value", sa.String(length=2000), nullable=False),
        sa.Column("content_type", sa.String(length=40), nullable=False, server_default="text"),
        sa.Column("updated_by", sa.Integer(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("(CURRENT_TIMESTAMP)")),
        sa.ForeignKeyConstraint(["updated_by"], ["users.id"], ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_page_content_key"), "page_content", ["key"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_page_content_key"), table_name="page_content")
    op.drop_table("page_content")
    op.drop_table("service_branch_prices")
    op.drop_table("campaigns")
    op.drop_table("media_files")
    op.drop_column("services", "image_url")
    op.drop_column("salons", "image_url")
