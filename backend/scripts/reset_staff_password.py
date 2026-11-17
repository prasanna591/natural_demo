"""Rotate or reset a staff account password from a trusted operator shell.

Usage (from the ``backend`` directory with the virtualenv active)::

    python -m scripts.reset_staff_password --email admin@naturals.example.com --password "new-strong-password"

The password is stored with the same salted-scrypt hashing the API uses, and
the target account must already exist and hold the ``admin`` or ``developer``
role. Customer accounts cannot be reset this way; customers use the normal
sign-in flow.
"""

from __future__ import annotations

import argparse
import sys

from app.auth import hash_password
from app.database import SessionLocal
from app.models import User


def reset_password(email: str, password: str) -> None:
    if len(password) < 12:
        raise SystemExit("Password must contain at least 12 characters.")
    with SessionLocal() as db:
        user = db.query(User).filter_by(email=email.strip().lower()).one_or_none()
        if user is None:
            raise SystemExit(f"No account found for email: {email}")
        if user.role not in {"admin", "developer"}:
            raise SystemExit(
                "Refusing to reset a customer password here; customers use the normal sign-in flow."
            )
        user.password_hash = hash_password(password)
        db.commit()
        print(f"Updated password for {user.email} (role={user.role}).")


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Rotate a staff account password.")
    parser.add_argument("--email", required=True)
    parser.add_argument("--password", required=True)
    args = parser.parse_args(argv)
    reset_password(args.email, args.password)
    sys.exit(0)


if __name__ == "__main__":
    main()
