# Naturals Salon API — Performance, Scalability and Operations

This document describes the performance work applied to the FastAPI backend:
what was slow, what changed, the measured before/after results, and how to run
and deploy it safely.

All numbers below were produced on this machine with the same synthetic
database copy, the same load-test script, and the same laptop-class hardware.
They are comparative results (identical conditions before vs after), not a
capacity guarantee for production hardware.

---

## 1. Architecture at a glance

Request flow (outermost first):

```
client
  -> CORS
  -> ObservabilityMiddleware   (request id, JSON access log, latency/error metrics)
  -> RateLimitMiddleware       (per-IP sliding window)
  -> GZipMiddleware            (responses >= 1 KB)
  -> FastAPI routes
       -> in-process TTL cache (public catalogue data only)
       -> SQLAlchemy Session  (pooled connection)
            -> SQLite (WAL) or PostgreSQL (statement timeout)
```

Key properties:

- **No new infrastructure was required.** No Redis, no worker queue, no load
  balancer was added. The cache, rate limiter and metrics are in-process and
  dependency-free (plus `psutil` for process stats).
- **Single-service booking contract preserved.** `BookingCreate.service_id`,
  all existing endpoints, admin flows, auth and the frontend booking screen are
  unchanged.
- **Critical data is never cached.** Availability, bookings, payments, auth and
  any user-specific response bypass the cache entirely.

---

## 2. What was slow in the baseline

The most severe problem was `GET /availability`. The original implementation
called a conflict-check query **for every stylist at every 15-minute slot**
(`_has_conflict` inside `_available_staff`, called in a loop). A day with 3
stylists and ~40 slots produced well over 100 sequential SQLite statements per
request, on top of loading staff and branch data.

Secondary problems:

- `GET /admin/overview` and `GET /admin/analytics` ran 7–9 separate `COUNT`
  queries, and used `func.date(...)` filters that prevent index use.
- `GET /bookings` and every admin list returned unbounded result sets.
- Catalogue reads (`/services`, `/salons`, `/categories`, `/offers`, review
  summaries, CMS content) hit SQLite on every page load.
- SQLite ran in default rollback-journal mode with a short busy timeout, so a
  booking write could block reads and produce `database is locked` under load.
- No compression, timeout, rate limiting, request IDs, structured logs, slow
  query logging, health probes or metrics existed.

---

## 3. Query and index improvements

### 3.1 Availability rewrite **(`app/main.py`)**

`/availability` now performs a fixed amount of work per request:

1. Load the salon and service (2 primary-key lookups).
2. Resolve eligible stylists with **one** query (`_eligible_staff`).
3. Load **all** active bookings for those stylists for the requested day with
   **one** query (`_day_conflicts`).
4. Evaluate slot conflicts **in memory** while walking the day.

Booking create/reschedule/admin-reschedule use `_conflicting_staff_ids`, a
single `SELECT DISTINCT staff_id ...` over the eligible stylist set. The
per-stylist `_has_conflict` helper was removed.

Result: statement count per availability request dropped from
`O(slots × stylists)` to a constant ~4.

### 3.2 Composite indexes (`app/models.py`, migration `0005`)

Added:

| Table | Index | Serves |
|---|---|---|
| `bookings` | `(staff_id, status, starts_at, ends_at)` | availability & conflict windows (covering index) |
| `bookings` | `(user_id, starts_at)` | customer booking list |
| `bookings` | `(salon_id, starts_at)` | branch-scoped booking queries |
| `bookings` | `(status, starts_at)` | admin filters/analytics by status + day |
| `users` | `(created_at)` | admin user list |
| `salons` | `(is_active, city, name)` | public branch list |
| `services` | `(is_active, category_id, name)` | public service list |
| `staff` | `(salon_id, is_active, name)` | branch staff list |
| `staff_services` | `(service_id, staff_id)` | reverse "who can do this service" lookup |
| `service_branch_prices` | `(salon_id, service_id)` | branch price lookup |
| `reviews` | `(salon_id, is_active, created_at)` | review summary/list |
| `audit_logs` | `(created_at)`, `(actor_id)` | admin activity/audit lists |
| `media_files` | `(created_at)` | media list |
| `campaigns` | `(is_active, position)` | public campaign list |
| `offers` | `(active, ends_at)` | active offers |

Single-column indexes fully covered by these composites were dropped to avoid
duplicate write cost (`bookings.user_id`, `bookings.status`,
`bookings.reference` — the unique constraint plus `(user_id, starts_at)`
already cover reads — and `reviews.salon_id`).

### 3.3 Executed plan evidence

`EXPLAIN QUERY PLAN` on the 20,006-booking copy:

| Query | Baseline | After |
|---|---|---|
| Availability day window | `SEARCH bookings USING INDEX ix_bookings_starts_at (starts_at<?)` | `SEARCH bookings USING COVERING INDEX ix_bookings_staff_status_starts (staff_id=? AND status=? AND starts_at<?)` |
| Admin status + day | `SEARCH ... ix_bookings_starts_at (starts_at>? AND starts_at<?)` | `SEARCH ... ix_bookings_status_starts (status=? AND starts_at>? AND starts_at<?)` |
| Branch staff list | `SCAN staff` + temp B-tree sort | `SEARCH staff USING INDEX ix_staff_salon_active_name (salon_id=? AND is_active=?)` |
| Customer bookings | scan/filter | `SEARCH bookings USING INDEX ix_bookings_user_starts (user_id=?)` |

### 3.4 Admin analytics and overview

- Seven separate `COUNT`/`SUM` queries became **one** aggregate `SELECT` using
  conditional `SUM(CASE ...)` expressions.
- The analytics range summary became **one** aggregate query.
- `func.date(starts_at) = '...'` filters were replaced with
  `starts_at >= day_start AND starts_at < day_end`, which keeps the timestamp
  index usable.
- Admin date filters use the same timestamp-range form.

### 3.5 Booking price lookups

Booking create, reschedule and admin update now reuse the branch-price row that
`_ensure_service_available_at_branch` already loaded
(`_price_from_branch_row`), removing a duplicate query per write.

### 3.6 Startup seeding (`app/seed.py`)

- One `SELECT DISTINCT salon_id FROM staff` replaces a per-branch "has staff?"
  query.
- Staff services are eager-loaded with `selectinload` instead of lazy-loaded
  per staff row.

---

## 4. Caching strategy

Implemented in `app/cache.py`: a thread-safe, bounded LRU + TTL cache with
**per-key stampede locks**.

| Setting | Default | Meaning |
|---|---|---|
| `CACHE_TTL_SECONDS` | 30 | TTL for catalogue/list responses |
| `CACHE_TTL_LONG_SECONDS` | 60 | TTL for categories and CMS content |
| `CACHE_MAX_ENTRIES` | 2000 | Hard entry cap (LRU eviction) |

### Cached (public, identical for every user)

- `/categories`, `/services`, `/services/{id}`
- `/salons`, `/salons/{id}`, `/salons/{id}/staff`
- `/reviews/summary`, `/reviews`
- `/offers`, `/app/settings`, `/public/content`, `/public/campaigns`

### Never cached

- `/availability` (changes with every booking)
- `/bookings*`, `/auth/*`, `/admin/*`
- payments, and anything derived from the authenticated user

### Invalidation

Every admin write path (services, salons, staff, branch prices, media,
campaigns, CMS content, app settings, review moderation) calls
`invalidate_public_cache()`, which synchronously clears the `public:` namespace
**in the current process**. Tests assert that an admin update is visible on the
very next read.

### Multi-worker behaviour

Each worker process has its own cache. Invalidation is immediate in the worker
that handled the write; other workers serve the previous value until the TTL
expires (bounded by 30–60 s). This is an explicit, documented trade-off. If
strict cross-worker coherence is required, deploy Redis; the cache interface is
small enough to swap.

---

## 5. Concurrency and booking safety

- Booking writes acquire a capacity lock before checking conflicts:
  - SQLite: `BEGIN IMMEDIATE`, serialising writers.
  - PostgreSQL: `SELECT ... FOR UPDATE` on the salon row.
- A second concurrent request for the same slot sees the confirmed booking and
  returns `409` instead of double-booking.
- SQLite is configured with `journal_mode=WAL`, `synchronous=NORMAL`,
  `foreign_keys=ON`, `busy_timeout=10000`, `temp_store=MEMORY`.
- Connection pool is configurable (`DB_POOL_SIZE`, `DB_MAX_OVERFLOW`,
  `DB_POOL_TIMEOUT`, `DB_POOL_RECYCLE`), with `pool_pre_ping` and LIFO reuse.
- PostgreSQL connections set `statement_timeout` via libpq options.

Race test result: 10 simultaneous identical bookings → exactly **one `201`,
nine `409`** before and after (correctness preserved), with median latency
dropping from **1,178.9 ms to 167.1 ms**.

---

## 6. Observability and protection

### Health endpoints

| Endpoint | Purpose | Response |
|---|---|---|
| `/health` | unchanged lightweight check | `{"status":"ok"}` |
| `/health/live` | liveness (no DB) | `{"status":"alive"}` |
| `/health/ready` | readiness (runs `SELECT 1`) | `{"status":"ready","database":"ok",...}` or `503` |
| `/metrics` | Prometheus text exposition | counters/gauges below |

### Metrics (`app/metrics.py`, no external dependency)

- `naturals_http_requests_total{method,path,status}`
- `naturals_http_request_duration_seconds` histogram
- `naturals_db_queries_total`, `naturals_db_query_duration_seconds`
- `naturals_cache_requests_total{result="hit|miss|eviction"}`
- `naturals_rate_limited_total`
- `naturals_unhandled_errors_total`
- `naturals_process_resident_memory_bytes`, CPU and thread gauges (psutil)

`METRICS_TOKEN` can protect `/metrics` with a bearer token.

### Logging

JSON logs via `app/observability.py`:

- Every request gets an `x-request-id` (accepted from the client or generated).
- Access log lines include method, route, status, duration, client and request id.
- Unhandled exceptions are logged with a stack trace and returned as
  `{"detail":"Internal server error.","request_id":"..."}`.
- Queries slower than `SLOW_QUERY_MS` are logged with **statement shape only**
  (no bind parameters, avoiding leaking emails/offer codes).

### Rate limiting

Per-IP sliding window, separate budgets for auth, availability, bookings, admin
and default traffic (`app/rate_limit.py`). Responses include
`X-RateLimit-*` headers and `429` with `Retry-After`. Set
`TRUST_PROXY_HEADERS=true` only behind a trusted proxy that overwrites
`X-Forwarded-For`.

---

## 7. Measured results

### Method

- Disposable copy of the production schema seeded with **20,006 bookings**,
  generated deterministically by `scripts/make_load_db.py`.
- `scripts/load_test.py` drives real HTTP traffic against a single uvicorn
  worker.
- Baseline = pre-change code; after = current code. Both on identical database
  contents and the same script. Rate limiting disabled during load tests so the
  limiter itself is not the bottleneck.

Reproduce:

```powershell
# from backend/
.\\.venv\\Scripts\\python.exe scripts\\make_load_db.py `
  --source naturals.db `
  --output "$env:TEMP\\opencode\\naturals-perf.db" `
  --bookings 20000 --force

$env:DATABASE_URL="sqlite:///$env:TEMP\\opencode\\naturals-perf.db"
$env:RATE_LIMIT_ENABLED="false"
.\\.venv\\Scripts\\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8032

.\\.venv\\Scripts\\python.exe scripts\\load_test.py --base-url http://127.0.0.1:8032 `
  --scenario availability --concurrency 40 --duration 15
.\\.venv\\Scripts\\python.exe scripts\\load_test.py --base-url http://127.0.0.1:8032 `
  --scenario catalog --concurrency 20 --duration 10
.\\.venv\\Scripts\\python.exe scripts\\load_test.py --base-url http://127.0.0.1:8032 `
  --scenario booking-race --users 10
.\\.venv\\Scripts\\python.exe scripts\\load_test.py --base-url http://127.0.0.1:8032 `
  --scenario mixed --concurrency 50 --duration 15
```

### Availability — 40 concurrent users, 15 s

| Metric | Baseline | After | Change |
|---|---|---|---|
| Throughput | 43 requests, 31 timed out | **133.7 rps** | ~40× more completed work |
| Median latency | 17,029.6 ms | **230.1 ms** | **~74× faster** |
| p95 latency | (timeouts) | **872.8 ms** | — |
| Errors | 31 timeouts / 43 | **0** | eliminated |
| Single warm call | 2,800.3 ms | **26.2 ms** | **~107× faster** |

### Catalogue — 20 concurrent users, 10 s

| Metric | Baseline | After | Change |
|---|---|---|---|
| Throughput | 95.9 rps | **219.8 rps** | ~2.3× |
| Median latency | 206.0 ms | **43.8 ms** | ~4.7× |
| p95 latency | 282.2 ms | 292.1 ms | comparable |
| Errors | 0 | **0** | — |

### Booking race — 10 simultaneous identical requests

| Metric | Baseline | After |
|---|---|---|
| Correct outcome | 1×201, 9×409 | **1×201, 9×409** |
| Median latency | 1,178.9 ms | **167.1 ms** |
| Errors | 0 | 0 |

### Mixed traffic — 50 concurrent users, 15 s

| Metric | Baseline-era run (with `/offers` bug) | After fix |
|---|---|---|
| Throughput | 44.7 rps | **58.7 rps** |
| Median latency | 757.9 ms | **610.4 ms** |
| p95 latency | 3,301.4 ms | **2,240.4 ms** |
| Errors | 23×500 (fixed) | **0 / 912** |

The earlier mixed run exposed a real bug: `/offers` called
`OfferOut.model_validate(row)` on an ORM object without
`from_attributes=True`. Fixed in `app/schemas.py` and covered by
`test_public_cached_endpoints_return_serialisable_payloads`.

### Metrics snapshot after the mixed run

```
naturals_http_requests_total{...status="200"}   all 200
naturals_db_queries_total                        1752
naturals_cache_requests_total{result="hit"}       579
naturals_cache_requests_total{result="miss"}       15
naturals_unhandled_errors_total                     0
```

Cache hit rate during the run: **~97%** on public catalogue reads.

---

## 8. Environment variables

See `.env.example` for the full annotated list. Summary:

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./naturals.db` | SQLite or PostgreSQL DSN |
| `DB_POOL_SIZE` / `DB_MAX_OVERFLOW` | 10 / 20 | connection pool |
| `DB_POOL_TIMEOUT` / `DB_POOL_RECYCLE` | 30 / 1800 | pool behaviour |
| `DB_STATEMENT_TIMEOUT_MS` | 15000 | PostgreSQL statement timeout |
| `LOG_LEVEL` | INFO | JSON log level |
| `ACCESS_LOG_ENABLED` | true | per-request JSON access log |
| `SLOW_QUERY_MS` | 200 | slow query threshold |
| `METRICS_TOKEN` | empty | optional bearer token for `/metrics` |
| `CACHE_TTL_SECONDS` | 30 | public cache TTL |
| `CACHE_TTL_LONG_SECONDS` | 60 | long public cache TTL |
| `CACHE_MAX_ENTRIES` | 2000 | cache size cap |
| `RATE_LIMIT_ENABLED` | true | master switch |
| `RATE_LIMIT_*_PER_MINUTE` | see `.env` | per-category budgets |
| `TRUST_PROXY_HEADERS` | false | honour `X-Forwarded-For` |
| `RUN_STARTUP_MIGRATIONS` | true | run Alembic + seed on boot |
| `STARTUP_LOCK_TIMEOUT_SECONDS` | 120 | cross-process startup lock wait |

New dependency: `psutil` (process CPU/memory metrics).

---

## 9. Deployment guidance

### Single worker (SQLite, current setup)

```powershell
cd backend
.\\.venv\\Scripts\\python.exe -m alembic upgrade head   # applies 0005 indexes
.\\.venv\\Scripts\\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

The startup lock plus `RUN_STARTUP_MIGRATIONS=true` keeps migrations/seeding
safe even if a process is restarted concurrently.

### Multiple workers

Run the one-shot bootstrap first, then start workers with startup migrations
disabled:

```powershell
.\\.venv\\Scripts\\python.exe -m app.bootstrap
$env:RUN_STARTUP_MIGRATIONS="false"
.\\.venv\\Scripts\\python.exe -m uvicorn app.main:app --workers 4 --host 0.0.0.0 --port 8000
```

Note the cache/rate-limiter are per worker: a second worker may serve cached
public data for up to the TTL after an admin edit, and rate limits are enforced
per worker.

### PostgreSQL

Point `DATABASE_URL` at PostgreSQL and apply the same Alembic migrations. The
engine automatically adds `statement_timeout` and pool settings; booking writes
use `SELECT ... FOR UPDATE` instead of the SQLite immediate transaction.

### Readiness and monitoring

- Point the load balancer at `/health/ready`, not `/health`.
- Scrape `/metrics` (with `Authorization: Bearer $METRICS_TOKEN` if set).
- Alert on `naturals_unhandled_errors_total`, 5xx rates, p95 latency, and
  `naturals_db_query_duration_seconds`.
- Ship JSON logs and index them by `request_id`.

### Media uploads

Uploads are written to `backend/media/uploads` (or `UPLOAD_DIR`). Multiple
workers/containers must share this directory (bind mount or object storage) —
this is a pre-existing constraint, not introduced by this work.

---

## 10. Files changed

New:

- `backend/app/cache.py`
- `backend/app/metrics.py`
- `backend/app/observability.py`
- `backend/app/rate_limit.py`
- `backend/app/startup.py`
- `backend/app/bootstrap.py`
- `backend/alembic/versions/0005_performance_indexes.py`
- `backend/scripts/load_test.py`
- `backend/scripts/make_load_db.py`
- `backend/README_PERFORMANCE.md` (this file)

Modified:

- `backend/app/main.py` — availability rewrite, caching, pagination, aggregate
  analytics, health/metrics endpoints, middleware wiring, cache invalidation,
  price-row reuse.
- `backend/app/models.py` — composite indexes, removal of redundant indexes.
- `backend/app/database.py` — pooling, SQLite pragmas, statement timeout,
  slow-query logging, query metrics.
- `backend/app/seed.py` — bulk staff queries, `selectinload`.
- `backend/app/schemas.py` — `OfferOut.from_attributes`.
- `backend/tests/test_api.py` — 5 performance/coverage tests (20 total).
- `backend/requirements.txt` — `psutil`.
- `backend/.env.example` — pool/cache/rate-limit/startup/logging/metrics vars.

---

## 11. Verification summary

- `pytest -q`: **20 passed**.
- Migration `0005` applies cleanly to a copy of `naturals.db` and drops
  superseded indexes.
- Load tests: 0 errors across availability, catalogue, booking race and mixed
  scenarios after the `/offers` fix.
- Booking correctness under concurrency preserved (1×201, rest 409).
- `/health` response unchanged (`{"status":"ok"}`); existing API contracts and
  the frontend booking flow untouched.
