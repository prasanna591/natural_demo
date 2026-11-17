"""Run migrations and seed data once before starting application workers.

Use this in container entrypoints or deployment scripts::

    python -m app.bootstrap
    uvicorn app.main:app --workers 4

After the bootstrap step, set ``RUN_STARTUP_MIGRATIONS=false`` so workers skip
schema work entirely.
"""

from __future__ import annotations

from .database import SessionLocal
from .observability import configure_logging
from .schema import ensure_schema
from .seed import seed_content, seed_data, seed_official_branch_prices, seed_official_services, seed_verified_branches
from .startup import startup_lock


def bootstrap() -> None:
    configure_logging()
    with startup_lock():
        ensure_schema()
        with SessionLocal() as db:
            seed_data(db)
            seed_official_services(db)
            seed_verified_branches(db)
            seed_official_branch_prices(db)
            seed_content(db)


def main() -> None:
    bootstrap()


if __name__ == "__main__":
    main()
