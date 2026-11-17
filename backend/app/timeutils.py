import os
from datetime import datetime, timezone

from zoneinfo import ZoneInfo

APP_TIMEZONE = os.getenv("APP_TIMEZONE", "Asia/Kolkata")


def utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def local_now(tz_name: str | None = None) -> datetime:
    """Return naive local time in APP_TIMEZONE (default Asia/Kolkata).

    Used for date comparisons (booking/availability/analytics/campaign windows)
    so the backend evaluates "today" in the salon's local timezone rather than
    the server's UTC wall clock.
    """
    tz = ZoneInfo(tz_name or APP_TIMEZONE)
    return datetime.now(tz).replace(tzinfo=None)
