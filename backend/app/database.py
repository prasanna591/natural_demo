import logging
import os
import time
from collections.abc import Generator

from dotenv import load_dotenv
from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from . import metrics
from .observability import request_id_var

load_dotenv()

logger = logging.getLogger("naturals.db")


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except ValueError:
        return default


class Base(DeclarativeBase):
    pass


DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./naturals.db")

# Pool sizing matters for PostgreSQL deployments with multiple uvicorn workers.
# SQLite uses a file lock for writes, but a larger read pool still prevents
# requests from queueing behind a single connection.
POOL_SIZE = _env_int("DB_POOL_SIZE", 10)
MAX_OVERFLOW = _env_int("DB_MAX_OVERFLOW", 20)
POOL_TIMEOUT = _env_int("DB_POOL_TIMEOUT", 30)
POOL_RECYCLE = _env_int("DB_POOL_RECYCLE", 1800)
STATEMENT_TIMEOUT_MS = _env_int("DB_STATEMENT_TIMEOUT_MS", 15000)
SLOW_QUERY_MS = _env_int("SLOW_QUERY_MS", 200)

engine_options: dict[str, object] = {
    "pool_pre_ping": True,
    "pool_size": POOL_SIZE,
    "max_overflow": MAX_OVERFLOW,
    "pool_timeout": POOL_TIMEOUT,
    "pool_recycle": POOL_RECYCLE,
    "pool_use_lifo": True,
}

if DATABASE_URL.startswith("sqlite"):
    engine_options["connect_args"] = {"check_same_thread": False, "timeout": 30}
elif DATABASE_URL.startswith(("postgresql", "postgres")):
    # psycopg passes libpq options through. This bounds runaway queries without
    # requiring a separate proxy or a client-side cancellation thread.
    engine_options["connect_args"] = {
        "application_name": "naturals-api",
        "options": f"-c statement_timeout={STATEMENT_TIMEOUT_MS}",
    }

engine = create_engine(DATABASE_URL, **engine_options)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


@event.listens_for(engine, "connect")
def _configure_sqlite_connection(dbapi_connection, _connection_record) -> None:
    """Use WAL and relaxed sync so readers are not blocked by booking writes.

    These pragmas are ignored gracefully by non-SQLite drivers because the
    listener is only registered for the SQLite engine.
    """
    if not DATABASE_URL.startswith("sqlite"):
        return
    database = engine.url.database or ""
    if database in {":memory:", ""}:
        return
    cursor = dbapi_connection.cursor()
    try:
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA busy_timeout=10000")
        cursor.execute("PRAGMA temp_store=MEMORY")
    finally:
        cursor.close()


@event.listens_for(engine, "before_cursor_execute")
def _before_cursor_execute(conn, cursor, statement, parameters, context, executemany) -> None:
    context._naturals_started_at = time.perf_counter()


@event.listens_for(engine, "after_cursor_execute")
def _after_cursor_execute(conn, cursor, statement, parameters, context, executemany) -> None:
    started = getattr(context, "_naturals_started_at", None)
    if started is None:
        return
    duration_ms = (time.perf_counter() - started) * 1000
    metrics.observe_db_query(duration_ms)
    if SLOW_QUERY_MS and duration_ms >= SLOW_QUERY_MS:
        # Never log bind parameters: they can contain customer email addresses
        # or offer codes. The statement shape is enough to locate the query.
        compact = " ".join(statement.split())
        logger.warning(
            "slow_query duration_ms=%.1f request_id=%s sql=%s",
            duration_ms,
            request_id_var.get("-"),
            compact[:400],
        )


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
