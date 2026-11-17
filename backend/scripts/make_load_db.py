"""Create a disposable database with realistic booking volume for load tests.

The production database is never modified: the script copies it to a temporary
location first, then inserts synthetic booking rows into the copy. Synthetic
rows are only used to make query plans and index behaviour measurable; they are
not shipped with the application.

Example:
    python scripts/make_load_db.py --source naturals.db --output %TEMP%/naturals-load.db --bookings 20000
"""

from __future__ import annotations

import argparse
import os
import random
import shutil
import sqlite3
from datetime import date, datetime, timedelta


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", default="naturals.db")
    parser.add_argument("--output", required=True)
    parser.add_argument("--bookings", type=int, default=20000)
    parser.add_argument("--force", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if os.path.exists(args.output):
        if not args.force:
            raise SystemExit(f"{args.output} already exists; pass --force to replace it.")
        os.remove(args.output)
    shutil.copyfile(args.source, args.output)

    random.seed(20261112)
    connection = sqlite3.connect(args.output)
    cursor = connection.cursor()
    try:
        users = [row[0] for row in cursor.execute("select id from users where role = 'customer'")]
        if not users:
            users = [row[0] for row in cursor.execute("select id from users")]
        staff = list(cursor.execute("select id, salon_id from staff where is_active = 1"))
        services = list(cursor.execute("select id, duration_minutes, price from services where is_active = 1"))
        if not (users and staff and services):
            raise SystemExit("The source database needs at least one user, stylist and service.")

        today = date.today()
        rows = []
        for index in range(args.bookings):
            staff_id, salon_id = random.choice(staff)
            service_id, duration, price = random.choice(services)
            # 70% historical rows (analytics), 30% upcoming rows (availability).
            if random.random() < 0.7:
                day = today - timedelta(days=random.randint(1, 180))
            else:
                day = today + timedelta(days=random.randint(1, 14))
            hour = random.randint(10, 19)
            minute = random.choice((0, 30))
            starts_at = datetime(day.year, day.month, day.day, hour, minute)
            ends_at = starts_at + timedelta(minutes=duration)
            status = random.choices(
                ["confirmed", "completed", "cancelled"], weights=(35, 55, 10), k=1
            )[0]
            if day < today and status == "confirmed":
                status = "completed"
            discount = round(float(price) * 0.1, 2) if random.random() < 0.1 else 0.0
            rows.append(
                (
                    f"LOAD-{index:08d}",
                    random.choice(users),
                    salon_id,
                    service_id,
                    staff_id,
                    starts_at,
                    ends_at,
                    status,
                    float(price),
                    None,
                    discount,
                    datetime.now(),
                )
            )

        cursor.executemany(
            """
            insert or ignore into bookings
                (reference, user_id, salon_id, service_id, staff_id, starts_at, ends_at,
                 status, price, offer_code, discount, created_at)
            values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            rows,
        )
        connection.commit()
        cursor.execute("analyze")
        connection.commit()
        print(
            f"prepared {args.output}: {cursor.execute('select count(*) from bookings').fetchone()[0]} bookings"
        )
    finally:
        connection.close()


if __name__ == "__main__":
    main()
