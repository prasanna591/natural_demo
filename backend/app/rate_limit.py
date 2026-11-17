"""Lightweight in-process rate limiting.

Each worker keeps its own sliding window. This is intentional: the deployment
target is a small number of uvicorn processes, and the limits below are high
enough to block abuse rather than normal traffic. Operators with a shared Redis
can add a distributed limiter later without changing the middleware contract.
"""

from __future__ import annotations

import math
import os
import threading
import time
from collections import deque
from dataclasses import dataclass

from starlette.responses import JSONResponse

from . import metrics


def _env_int(name: str, default: int) -> int:
    try:
        return max(1, int(os.getenv(name, str(default))))
    except ValueError:
        return default


def _truthy(value: str | None) -> bool:
    return (value or "").strip().lower() in {"1", "true", "yes", "on"}


class SlidingWindowLimiter:
    def __init__(self, max_keys: int = 50_000) -> None:
        self._buckets: dict[str, deque[float]] = {}
        self._lock = threading.Lock()
        self._max_keys = max_keys
        self._last_cleanup = time.monotonic()

    def check(self, key: str, limit: int, window: float = 60.0) -> tuple[bool, int, int, int]:
        """Return ``(allowed, remaining, retry_after, reset_seconds)``."""
        now = time.monotonic()
        cutoff = now - window
        with self._lock:
            bucket = self._buckets.get(key)
            if bucket is None:
                bucket = deque()
                self._buckets[key] = bucket
            while bucket and bucket[0] <= cutoff:
                bucket.popleft()
            if len(bucket) >= limit:
                retry_after = max(1, math.ceil(bucket[0] + window - now))
                return False, 0, retry_after, retry_after
            bucket.append(now)
            remaining = limit - len(bucket)
            reset_seconds = max(1, math.ceil(bucket[0] + window - now))
            if now - self._last_cleanup >= 60 or len(self._buckets) > self._max_keys:
                self._cleanup(cutoff)
            return True, remaining, 0, reset_seconds

    def _cleanup(self, cutoff: float) -> None:
        stale = [key for key, bucket in self._buckets.items() if not bucket or bucket[-1] <= cutoff]
        for key in stale:
            self._buckets.pop(key, None)
        self._last_cleanup = time.monotonic()


@dataclass(frozen=True)
class Limit:
    category: str
    per_minute: int


class RateLimitMiddleware:
    def __init__(self, app) -> None:
        self.app = app
        self.enabled = _truthy(os.getenv("RATE_LIMIT_ENABLED", "true"))
        self.limiter = SlidingWindowLimiter()
        self.default_limit = Limit("default", _env_int("RATE_LIMIT_DEFAULT_PER_MINUTE", 1200))
        self.auth_limit = Limit("auth", _env_int("RATE_LIMIT_AUTH_PER_MINUTE", 60))
        self.booking_limit = Limit("booking", _env_int("RATE_LIMIT_BOOKING_PER_MINUTE", 120))
        self.availability_limit = Limit("availability", _env_int("RATE_LIMIT_AVAILABILITY_PER_MINUTE", 300))
        self.admin_limit = Limit("admin", _env_int("RATE_LIMIT_ADMIN_PER_MINUTE", 600))

    def _limit_for(self, method: str, path: str) -> Limit:
        if path.startswith("/auth/"):
            return self.auth_limit
        if path.startswith("/availability"):
            return self.availability_limit
        if path.startswith("/admin/"):
            return self.admin_limit
        if path == "/bookings" or path.startswith("/bookings/"):
            return self.booking_limit
        return self.default_limit

    @staticmethod
    def _client_ip(scope) -> str:
        if _truthy(os.getenv("TRUST_PROXY_HEADERS", "false")):
            for name, value in scope.get("headers", []):
                if name == b"x-forwarded-for":
                    return value.split(b",")[0].strip().decode("latin-1") or "unknown"
        client = scope.get("client")
        return client[0] if client else "unknown"

    async def __call__(self, scope, receive, send) -> None:
        if scope["type"] != "http" or not self.enabled:
            await self.app(scope, receive, send)
            return

        path = scope.get("path", "")
        if path.startswith("/health") or path == "/metrics" or path.startswith("/media/"):
            await self.app(scope, receive, send)
            return

        method = scope.get("method", "GET")
        limit = self._limit_for(method, path)
        key = f"{limit.category}:{self._client_ip(scope)}"
        allowed, remaining, retry_after, reset_seconds = self.limiter.check(
            key, limit.per_minute
        )
        headers = {
            "X-RateLimit-Limit": str(limit.per_minute),
            "X-RateLimit-Remaining": str(remaining),
            "X-RateLimit-Reset": str(reset_seconds),
        }
        if not allowed:
            metrics.observe_rate_limit()
            headers["Retry-After"] = str(retry_after)
            response = JSONResponse(
                {"detail": "Too many requests. Please retry shortly."},
                status_code=429,
                headers=headers,
            )
            await response(scope, receive, send)
            return

        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                message["headers"] = list(message.get("headers", [])) + [
                    (name.lower().encode("latin-1"), value.encode("latin-1"))
                    for name, value in headers.items()
                ]
            await send(message)

        await self.app(scope, receive, send_wrapper)
