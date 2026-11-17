"""Composite indexes for booking, catalogue, review and admin query paths.

Revision ID: 0005_performance_indexes
Revises: 0004_reviews

The indexes added here match the queries executed by the API:

* availability and conflict checks filter by stylist, status and time window
* customer booking lists filter by user and order by appointment time
* admin lists and analytics filter by status/salon and sort by time
* catalogue and staff lookups filter by active flag and parent id
* audit, media and campaign lists sort by recency or position

Single-column indexes that are fully covered by a new composite index are
dropped so writes do not maintain duplicate structures.
"""
from alembic import op
import sqlalchemy as sa

revision = "0005_performance_indexes"
down_revision = "0004_reviews"
branch_labels = None
depends_on = None


NEW_INDEXES = (
    ("ix_bookings_staff_status_starts", "bookings", ["staff_id", "status", "starts_at", "ends_at"]),
    ("ix_bookings_user_starts", "bookings", ["user_id", "starts_at"]),
    ("ix_bookings_salon_starts", "bookings", ["salon_id", "starts_at"]),
    ("ix_bookings_status_starts", "bookings", ["status", "starts_at"]),
    ("ix_users_created_at", "users", ["created_at"]),
    ("ix_salons_active_city_name", "salons", ["is_active", "city", "name"]),
    ("ix_services_active_category_name", "services", ["is_active", "category_id", "name"]),
    ("ix_staff_salon_active_name", "staff", ["salon_id", "is_active", "name"]),
    ("ix_staff_services_service_staff", "staff_services", ["service_id", "staff_id"]),
    ("ix_branch_prices_salon_service", "service_branch_prices", ["salon_id", "service_id"]),
    ("ix_reviews_salon_active_created", "reviews", ["salon_id", "is_active", "created_at"]),
    ("ix_reviews_service_id", "reviews", ["service_id"]),
    ("ix_audit_logs_created_at", "audit_logs", ["created_at"]),
    ("ix_audit_logs_actor_id", "audit_logs", ["actor_id"]),
    ("ix_media_files_created_at", "media_files", ["created_at"]),
    ("ix_campaigns_active_position", "campaigns", ["is_active", "position"]),
    ("ix_offers_active_window", "offers", ["active", "ends_at"]),
)

# Superseded by a composite index with the same leading columns, or by the
# unique constraint on bookings.reference.
REDUNDANT_INDEXES = (
    ("ix_bookings_user_id", "bookings"),
    ("ix_bookings_status", "bookings"),
    ("ix_bookings_reference", "bookings"),
    ("ix_reviews_salon_id", "reviews"),
)


def _existing_indexes(table_name: str) -> set[str]:
    inspector = sa.inspect(op.get_bind())
    return {index["name"] for index in inspector.get_indexes(table_name)}


def upgrade() -> None:
    for name, table, columns in NEW_INDEXES:
        if name not in _existing_indexes(table):
            op.create_index(name, table, columns)

    for name, table in REDUNDANT_INDEXES:
        if name in _existing_indexes(table):
            op.drop_index(name, table_name=table)


def downgrade() -> None:
    for name, table in reversed(REDUNDANT_INDEXES):
        if name not in _existing_indexes(table):
            if name == "ix_bookings_reference":
                op.create_index(name, table, ["reference"])
            elif name == "ix_reviews_salon_id":
                op.create_index(name, table, ["salon_id"])
            else:
                op.create_index(name, table, ["user_id"] if name.endswith("user_id") else ["status"])

    for name, table, _columns in reversed(NEW_INDEXES):
        if name in _existing_indexes(table):
            op.drop_index(name, table_name=table)
