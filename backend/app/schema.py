"""Apply schema changes to existing databases at application startup.

Fresh databases are created from the current SQLAlchemy models and stamped at
the latest Alembic revision. Databases that already carry an ``alembic_version``
table are upgraded to head so deployments never run against an outdated schema.
"""
import os

from alembic import command
from alembic.config import Config
from sqlalchemy import inspect, text

from .database import Base, engine

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ALEMBIC_INI = os.path.join(BACKEND_DIR, "alembic.ini")
ALEMBIC_DIR = os.path.join(BACKEND_DIR, "alembic")

# Columns added after the original schema. Used only for very old databases that
# predate Alembic version tracking.
_LEGACY_COLUMNS = {
    "campaigns": {"audience": "VARCHAR(32) NOT NULL DEFAULT 'Everyone'"},
    "service_branch_prices": {"is_available": "BOOLEAN NOT NULL DEFAULT TRUE"},
    "audit_logs": {"detail": "VARCHAR(600)"},
}


def _repair_legacy_columns() -> None:
    inspector = inspect(engine)
    with engine.begin() as connection:
        for table, columns in _LEGACY_COLUMNS.items():
            if not inspector.has_table(table):
                continue
            existing = {column["name"] for column in inspector.get_columns(table)}
            for name, definition in columns.items():
                if name not in existing:
                    connection.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {definition}"))


def _alembic_config() -> Config:
    config = Config(ALEMBIC_INI)
    config.set_main_option("script_location", ALEMBIC_DIR)
    return config


def ensure_schema() -> None:
    config = _alembic_config()
    if inspect(engine).has_table("alembic_version"):
        command.upgrade(config, "head")
        Base.metadata.create_all(bind=engine)
        return
    Base.metadata.create_all(bind=engine)
    _repair_legacy_columns()
    command.stamp(config, "head")
