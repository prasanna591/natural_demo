"""Cross-process lock used while migrations and seed data are applied.

Running ``uvicorn --workers N`` means every worker executes the lifespan hook.
Without a lock, several workers can race Alembic upgrades and the idempotent
seed routines. SQLite uses a lock file next to the database; PostgreSQL uses a
session advisory lock.
"""

from __future__ import annotations

import logging
import os
import time
from contextlib import contextmanager

from sqlalchemy import text

from .database import engine

logger = logging.getLogger("naturals.startup")

_ADVISORY_LOCK_KEY = 0x4E415455  # "NATU"
_STALE_LOCK_SECONDS = 300


def _timeout() -> float:
    try:
        return max(1.0, float(os.getenv("STARTUP_LOCK_TIMEOUT_SECONDS", "120")))
    except ValueError:
        return 120.0


@contextmanager
def startup_lock():
    timeout = _timeout()
    dialect = engine.dialect.name
    database = engine.url.database or ""

    if dialect == "sqlite" and database not in {"", ":memory:"}:
        lock_path = os.path.abspath(database) + ".startup.lock"
        deadline = time.monotonic() + timeout
        acquired = False
        while not acquired:
            try:
                fd = os.open(lock_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
                os.write(fd, str(os.getpid()).encode("ascii"))
                os.close(fd)
                acquired = True
            except FileExistsError:
                try:
                    if time.time() - os.path.getmtime(lock_path) > _STALE_LOCK_SECONDS:
                        logger.warning("Removing stale startup lock %s", lock_path)
                        os.remove(lock_path)
                        continue
                except FileNotFoundError:
                    continue
                if time.monotonic() >= deadline:
                    raise TimeoutError(f"Timed out waiting for the startup lock at {lock_path}.")
                time.sleep(0.2)
        try:
            yield
        finally:
            try:
                os.remove(lock_path)
            except FileNotFoundError:
                pass
        return

    if dialect in {"postgresql", "postgres"}:
        deadline = time.monotonic() + timeout
        with engine.connect() as connection:
            acquired = bool(
                connection.execute(
                    text("SELECT pg_try_advisory_lock(:key)"), {"key": _ADVISORY_LOCK_KEY}
                ).scalar()
            )
            while not acquired:
                if time.monotonic() >= deadline:
                    raise TimeoutError("Timed out waiting for the PostgreSQL startup advisory lock.")
                time.sleep(0.2)
                acquired = bool(
                    connection.execute(
                        text("SELECT pg_try_advisory_lock(:key)"), {"key": _ADVISORY_LOCK_KEY}
                    ).scalar()
                )
            try:
                yield
            finally:
                connection.execute(
                    text("SELECT pg_advisory_unlock(:key)"), {"key": _ADVISORY_LOCK_KEY}
                )
                connection.commit()
        return

    yield
