"""Small, dependency-free Prometheus metrics registry.

The application does not need a full metrics SDK. Counters and histograms are
kept in memory behind a lock, bounded by the finite set of route templates, and
rendered as Prometheus text when ``/metrics`` is scraped.
"""

from __future__ import annotations

import bisect
import os
import threading
import time
from collections import defaultdict
from typing import Any

try:  # psutil is optional at import time so tests work in minimal images.
    import psutil
except ImportError:  # pragma: no cover - only hit in stripped-down installs
    psutil = None


HTTP_BUCKETS = (0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0)
DB_BUCKETS = (0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0)

_lock = threading.Lock()
_started_at = time.time()

_http_counts: dict[tuple[str, str, int], int] = defaultdict(int)
_http_hist: dict[tuple[str, str], list[int]] = {}
_http_sum: dict[tuple[str, str], float] = defaultdict(float)
_http_count: dict[tuple[str, str], int] = defaultdict(int)

_db_count = 0
_db_sum = 0.0
_db_hist = [0] * (len(DB_BUCKETS) + 1)
_db_slow = 0

_cache_hits = 0
_cache_misses = 0
_cache_evictions = 0

_rate_limited = 0
_unhandled_errors = 0


def observe_http(method: str, path: str, status: int, seconds: float) -> None:
    global _http_hist
    key = (method, path)
    with _lock:
        _http_counts[(method, path, status)] += 1
        _http_sum[key] += seconds
        _http_count[key] += 1
        histogram = _http_hist.get(key)
        if histogram is None:
            histogram = [0] * (len(HTTP_BUCKETS) + 1)
            _http_hist[key] = histogram
        index = bisect.bisect_left(HTTP_BUCKETS, seconds)
        for bucket_index in range(index, len(histogram)):
            histogram[bucket_index] += 1


def observe_db_query(duration_ms: float) -> None:
    global _db_count, _db_sum, _db_slow
    seconds = duration_ms / 1000
    with _lock:
        _db_count += 1
        _db_sum += seconds
        index = bisect.bisect_left(DB_BUCKETS, seconds)
        for bucket_index in range(index, len(_db_hist)):
            _db_hist[bucket_index] += 1
        if duration_ms >= 200:
            _db_slow += 1


def observe_cache(hit: bool) -> None:
    global _cache_hits, _cache_misses
    with _lock:
        if hit:
            _cache_hits += 1
        else:
            _cache_misses += 1


def observe_cache_eviction(count: int = 1) -> None:
    global _cache_evictions
    with _lock:
        _cache_evictions += count


def observe_rate_limit() -> None:
    global _rate_limited
    with _lock:
        _rate_limited += 1


def observe_unhandled_error() -> None:
    global _unhandled_errors
    with _lock:
        _unhandled_errors += 1


def snapshot() -> dict[str, Any]:
    with _lock:
        return {
            "requests": sum(_http_counts.values()),
            "cache_hits": _cache_hits,
            "cache_misses": _cache_misses,
            "cache_evictions": _cache_evictions,
            "db_queries": _db_count,
            "db_query_seconds": round(_db_sum, 4),
            "db_slow_queries": _db_slow,
            "rate_limited": _rate_limited,
            "unhandled_errors": _unhandled_errors,
        }


def _escape(value: str) -> str:
    return value.replace("\\", "\\\\").replace("\n", "\\n").replace('"', '\\"')


def _line(name: str, labels: dict[str, str] | None, value: float | int) -> str:
    if labels:
        rendered = ",".join(f'{key}="{_escape(str(value_))}"' for key, value_ in labels.items())
        return f"{name}{{{rendered}}} {value}"
    return f"{name} {value}"


def render_prometheus() -> str:
    with _lock:
        http_counts = dict(_http_counts)
        http_hist = {key: list(value) for key, value in _http_hist.items()}
        http_sum = dict(_http_sum)
        http_count = dict(_http_count)
        db_count = _db_count
        db_sum = _db_sum
        db_hist = list(_db_hist)
        db_slow = _db_slow
        cache_hits = _cache_hits
        cache_misses = _cache_misses
        cache_evictions = _cache_evictions
        rate_limited = _rate_limited
        unhandled_errors = _unhandled_errors

    lines: list[str] = [
        "# HELP naturals_http_requests_total HTTP requests handled, by route and status.",
        "# TYPE naturals_http_requests_total counter",
    ]
    for (method, path, status), count in sorted(http_counts.items()):
        lines.append(
            _line(
                "naturals_http_requests_total",
                {"method": method, "path": path, "status": str(status)},
                count,
            )
        )

    lines += [
        "# HELP naturals_http_request_duration_seconds HTTP request latency.",
        "# TYPE naturals_http_request_duration_seconds histogram",
    ]
    for (method, path), histogram in sorted(http_hist.items()):
        for index, bucket in enumerate(HTTP_BUCKETS):
            lines.append(
                _line(
                    "naturals_http_request_duration_seconds_bucket",
                    {"method": method, "path": path, "le": str(bucket)},
                    histogram[index],
                )
            )
        lines.append(
            _line(
                "naturals_http_request_duration_seconds_bucket",
                {"method": method, "path": path, "le": "+Inf"},
                histogram[-1],
            )
        )
        lines.append(
            _line(
                "naturals_http_request_duration_seconds_sum",
                {"method": method, "path": path},
                round(http_sum.get((method, path), 0.0), 6),
            )
        )
        lines.append(
            _line(
                "naturals_http_request_duration_seconds_count",
                {"method": method, "path": path},
                http_count.get((method, path), 0),
            )
        )

    lines += [
        "# HELP naturals_db_queries_total SQL statements executed.",
        "# TYPE naturals_db_queries_total counter",
        _line("naturals_db_queries_total", None, db_count),
        "# HELP naturals_db_query_duration_seconds SQL statement latency.",
        "# TYPE naturals_db_query_duration_seconds histogram",
    ]
    for index, bucket in enumerate(DB_BUCKETS):
        lines.append(
            _line("naturals_db_query_duration_seconds_bucket", {"le": str(bucket)}, db_hist[index])
        )
    lines.append(_line("naturals_db_query_duration_seconds_bucket", {"le": "+Inf"}, db_hist[-1]))
    lines.append(_line("naturals_db_query_duration_seconds_sum", None, round(db_sum, 6)))
    lines.append(_line("naturals_db_query_duration_seconds_count", None, db_count))
    lines += [
        "# HELP naturals_db_slow_queries_total SQL statements slower than the configured threshold.",
        "# TYPE naturals_db_slow_queries_total counter",
        _line("naturals_db_slow_queries_total", None, db_slow),
        "# HELP naturals_cache_requests_total Cache lookups.",
        "# TYPE naturals_cache_requests_total counter",
        _line("naturals_cache_requests_total", {"result": "hit"}, cache_hits),
        _line("naturals_cache_requests_total", {"result": "miss"}, cache_misses),
        _line("naturals_cache_requests_total", {"result": "eviction"}, cache_evictions),
        "# HELP naturals_rate_limited_total Requests rejected by the rate limiter.",
        "# TYPE naturals_rate_limited_total counter",
        _line("naturals_rate_limited_total", None, rate_limited),
        "# HELP naturals_unhandled_errors_total Requests that raised an unhandled exception.",
        "# TYPE naturals_unhandled_errors_total counter",
        _line("naturals_unhandled_errors_total", None, unhandled_errors),
        "# HELP naturals_uptime_seconds Process uptime.",
        "# TYPE naturals_uptime_seconds gauge",
        _line("naturals_uptime_seconds", None, round(time.time() - _started_at, 1)),
    ]

    if psutil is not None:
        process = psutil.Process(os.getpid())
        try:
            memory = process.memory_info()
            cpu = process.cpu_times()
            lines += [
                "# HELP naturals_process_resident_memory_bytes Resident memory used by the process.",
                "# TYPE naturals_process_resident_memory_bytes gauge",
                _line("naturals_process_resident_memory_bytes", None, memory.rss),
                "# HELP naturals_process_cpu_seconds_total CPU time consumed by the process.",
                "# TYPE naturals_process_cpu_seconds_total counter",
                _line("naturals_process_cpu_seconds_total", None, round(cpu.user + cpu.system, 3)),
            ]
        except Exception:  # pragma: no cover - process introspection is best effort
            pass

    return "\n".join(lines) + "\n"
