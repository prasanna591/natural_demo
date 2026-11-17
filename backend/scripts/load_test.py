"""Repeatable HTTP load test for the Naturals API.

This script intentionally uses only dependencies already required by the
backend (httpx). It measures real requests against a running server, so the
same command can be used before and after an optimisation change.

Examples
--------
    python scripts/load_test.py --scenario mixed --concurrency 50 --duration 20
    python scripts/load_test.py --scenario availability --concurrency 50 --duration 20
    python scripts/load_test.py --scenario booking-race --users 10

The output is a single JSON document so results can be archived and compared.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import random
import statistics
import time
from collections import Counter
from datetime import date, timedelta
from typing import Any

import httpx


PERCENTILES = (50, 90, 95, 99)


def percentile(values: list[float], pct: int) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    index = min(len(ordered) - 1, max(0, round((pct / 100) * len(ordered)) - 1))
    return ordered[index]


def summarise(samples: list[dict[str, Any]], wall_seconds: float) -> dict[str, Any]:
    latencies = [sample["ms"] for sample in samples if sample["status"] is not None]
    statuses = Counter(str(sample["status"]) for sample in samples)
    errors = Counter(sample["error"] for sample in samples if sample["error"])
    ok = sum(1 for sample in samples if sample["status"] is not None and 200 <= sample["status"] < 400)
    result = {
        "requests": len(samples),
        "ok": ok,
        "error_rate": round((len(samples) - ok) / len(samples), 4) if samples else 0,
        "wall_seconds": round(wall_seconds, 2),
        "throughput_rps": round(len(samples) / wall_seconds, 1) if wall_seconds else 0,
        "latency_ms": {
            "mean": round(statistics.fmean(latencies), 1) if latencies else 0,
            "min": round(min(latencies), 1) if latencies else 0,
            "max": round(max(latencies), 1) if latencies else 0,
            **{f"p{pct}": round(percentile(latencies, pct), 1) for pct in PERCENTILES},
        },
        "status_counts": dict(sorted(statuses.items())),
    }
    if errors:
        result["errors"] = dict(errors)
    return result


class Target:
    """Cached, realistic request parameters discovered from the live API."""

    def __init__(self, client: httpx.AsyncClient) -> None:
        self.pairs: list[tuple[int, int]] = []
        self.dates: list[str] = []

    async def discover(self, client: httpx.AsyncClient) -> None:
        salons = (await client.get("/salons")).json()
        active = [salon for salon in salons if salon.get("is_active", True)]
        random.shuffle(active)
        for salon in active[:12]:
            catalogue = (await client.get("/services", params={"salon_id": salon["id"]})).json()
            if not catalogue:
                continue
            for service in random.sample(catalogue, min(4, len(catalogue))):
                self.pairs.append((salon["id"], service["id"]))
        if not self.pairs:
            raise RuntimeError("Could not discover a salon/service pair from the API.")
        self.dates = [
            (date.today() + timedelta(days=offset)).isoformat()
            for offset in range(1, 15)
        ]

    def availability_url(self) -> str:
        salon_id, service_id = random.choice(self.pairs)
        return f"/availability?salon_id={salon_id}&service_id={service_id}&date={random.choice(self.dates)}"

    def catalogue_url(self) -> str:
        salon_id, _ = random.choice(self.pairs)
        return f"/services?salon_id={salon_id}"


async def timed(client: httpx.AsyncClient, method: str, url: str, **kwargs: Any) -> dict[str, Any]:
    started = time.perf_counter()
    try:
        response = await client.request(method, url, **kwargs)
        return {
            "status": response.status_code,
            "ms": (time.perf_counter() - started) * 1000,
            "error": None if response.status_code < 500 else response.text[:200],
        }
    except Exception as exc:  # noqa: BLE001 - load tests report the failure class
        return {
            "status": None,
            "ms": (time.perf_counter() - started) * 1000,
            "error": type(exc).__name__,
        }


async def worker(
    client: httpx.AsyncClient,
    target: Target,
    scenario: str,
    stop_at: float,
    samples: list[dict[str, Any]],
) -> None:
    while time.perf_counter() < stop_at:
        if scenario == "catalog":
            request = ("GET", target.catalogue_url())
        elif scenario == "availability":
            request = ("GET", target.availability_url())
        else:
            roll = random.random()
            if roll < 0.5:
                request = ("GET", target.catalogue_url())
            elif roll < 0.85:
                request = ("GET", target.availability_url())
            elif roll < 0.92:
                request = ("GET", "/salons")
            elif roll < 0.96:
                request = ("GET", "/offers")
            else:
                request = ("GET", "/public/campaigns")
        samples.append(await timed(client, *request))


async def run_load(args: argparse.Namespace) -> dict[str, Any]:
    limits = httpx.Limits(max_connections=args.concurrency * 2, max_keepalive_connections=args.concurrency * 2)
    async with httpx.AsyncClient(base_url=args.base_url, timeout=30, limits=limits) as client:
        target = Target(client)
        await target.discover(client)
        for _ in range(10):
            await client.get(target.catalogue_url())

        samples: list[dict[str, Any]] = []
        started = time.perf_counter()
        stop_at = started + args.duration
        await asyncio.gather(
            *(worker(client, target, args.scenario, stop_at, samples) for _ in range(args.concurrency))
        )
        wall = time.perf_counter() - started

    return {
        "scenario": args.scenario,
        "concurrency": args.concurrency,
        "duration_seconds": args.duration,
        "targets": {
            "salon_service_pairs": len(target.pairs),
            "dates": len(target.dates),
        },
        **summarise(samples, wall),
    }


async def run_booking_race(args: argparse.Namespace) -> dict[str, Any]:
    async with httpx.AsyncClient(base_url=args.base_url, timeout=30) as client:
        target = Target(client)
        await target.discover(client)
        salon_id, service_id = target.pairs[0]
        staff = (
            await client.get(f"/salons/{salon_id}/staff", params={"service_id": service_id})
        ).json()
        if not staff:
            raise RuntimeError("No eligible staff found for the booking race.")
        # Far enough ahead to avoid clashing with demo/test bookings.
        booking_date = (date.today() + timedelta(days=45)).isoformat()
        payload = {
            "salon_id": salon_id,
            "service_id": service_id,
            "staff_id": staff[0]["id"],
            "date": booking_date,
            "start_time": "10:00",
        }

        tokens = []
        for index in range(args.users):
            email = f"load-race-{int(time.time() * 1000)}-{index}@example.com"
            response = await client.post(
                "/auth/register",
                json={
                    "name": f"Load Race {index}",
                    "email": email,
                    "password": "Load-test-password-2026",
                },
            )
            if response.status_code not in (200, 201):
                raise RuntimeError(f"Registration failed: {response.status_code} {response.text[:200]}")
            tokens.append(response.json()["access_token"])

        started = time.perf_counter()
        samples = await asyncio.gather(
            *(
                timed(
                    client,
                    "POST",
                    "/bookings",
                    json=payload,
                    headers={"Authorization": f"Bearer {token}"},
                )
                for token in tokens
            )
        )
        wall = time.perf_counter() - started

    result = summarise(list(samples), wall)
    result.update(
        {
            "scenario": "booking-race",
            "users": args.users,
            "expected": "exactly one 201; every other request 409",
            "correct": result["status_counts"].get("201", 0) == 1
            and result["status_counts"].get("409", 0) == args.users - 1,
        }
    )
    return result


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    parser.add_argument("--scenario", choices=["catalog", "availability", "mixed", "booking-race"], default="mixed")
    parser.add_argument("--concurrency", type=int, default=50)
    parser.add_argument("--duration", type=float, default=20)
    parser.add_argument("--users", type=int, default=10, help="Concurrent users for the booking race.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.scenario == "booking-race":
        result = asyncio.run(run_booking_race(args))
    else:
        result = asyncio.run(run_load(args))
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
