"""Thread-safe TTL cache for public, non-transactional data only.

Availability, bookings, payments and any user-specific response deliberately
bypass this cache. Public entries are short-lived and are also invalidated
synchronously whenever an administrator changes the underlying data. In a
multi-worker deployment each process has its own cache; the short TTL bounds
how long another worker can serve the previous value.
"""

from __future__ import annotations

import os
import threading
import time
from collections import OrderedDict
from collections.abc import Callable
from typing import Any

from . import metrics


def _env_int(name: str, default: int) -> int:
    try:
        return max(1, int(os.getenv(name, str(default))))
    except ValueError:
        return default


_MISS = object()


class TTLCache:
    def __init__(self, max_entries: int | None = None) -> None:
        self.max_entries = max_entries or _env_int("CACHE_MAX_ENTRIES", 2000)
        self._entries: OrderedDict[str, tuple[float, Any]] = OrderedDict()
        self._locks: dict[str, threading.Lock] = {}
        self._lock = threading.RLock()

    def get(self, key: str, default: Any = _MISS) -> Any:
        now = time.monotonic()
        with self._lock:
            entry = self._entries.get(key)
            if entry is None:
                metrics.observe_cache(False)
                return default
            expires_at, value = entry
            if expires_at <= now:
                self._entries.pop(key, None)
                metrics.observe_cache(False)
                return default
            self._entries.move_to_end(key)
            metrics.observe_cache(True)
            return value

    def set(self, key: str, value: Any, ttl_seconds: float) -> None:
        with self._lock:
            self._entries[key] = (time.monotonic() + ttl_seconds, value)
            self._entries.move_to_end(key)
            evicted = 0
            while len(self._entries) > self.max_entries:
                self._entries.popitem(last=False)
                evicted += 1
        if evicted:
            metrics.observe_cache_eviction(evicted)

    def get_or_set(self, key: str, ttl_seconds: float, producer: Callable[[], Any]) -> Any:
        # A per-key lock prevents a cache stampede when a popular key expires
        # while many requests arrive at once.
        with self._lock:
            key_lock = self._locks.get(key)
            if key_lock is None:
                key_lock = threading.Lock()
                self._locks[key] = key_lock
        with key_lock:
            value = self.get(key)
            if value is not _MISS:
                return value
            value = producer()
            self.set(key, value, ttl_seconds)
            with self._lock:
                if self._locks.get(key) is key_lock:
                    self._locks.pop(key, None)
            return value

    def delete_prefix(self, prefix: str) -> int:
        with self._lock:
            keys = [key for key in self._entries if key.startswith(prefix)]
            for key in keys:
                self._entries.pop(key, None)
            return len(keys)

    def clear(self) -> None:
        with self._lock:
            self._entries.clear()

    def stats(self) -> dict[str, int]:
        with self._lock:
            return {
                "entries": len(self._entries),
                "max_entries": self.max_entries,
                "pending_locks": len(self._locks),
            }


# Public GET endpoints share the "public:" namespace. Any administrator write
# invalidates the namespace, which is deliberately conservative and cheap.
PUBLIC_TTL = _env_int("CACHE_TTL_SECONDS", 30)
PUBLIC_LONG_TTL = _env_int("CACHE_TTL_LONG_SECONDS", 60)
cache = TTLCache()


def public_key(*parts: object) -> str:
    return "public:" + ":".join(str(part) for part in parts)


def invalidate_public_cache() -> int:
    return cache.delete_prefix("public:")
