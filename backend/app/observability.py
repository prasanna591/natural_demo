"""Structured request logging, request IDs, and latency metrics."""

from __future__ import annotations

import json
import logging
import os
import sys
import time
import uuid
from contextvars import ContextVar
from datetime import datetime, timezone

from starlette.responses import JSONResponse

from . import metrics


request_id_var: ContextVar[str] = ContextVar("request_id", default="-")
logger = logging.getLogger("naturals.http")
_configured = False


class JsonFormatter(logging.Formatter):
    """One JSON object per line, safe for log shippers and local terminals."""

    _reserved = {
        "name",
        "msg",
        "args",
        "levelname",
        "levelno",
        "pathname",
        "filename",
        "module",
        "exc_info",
        "exc_text",
        "stack_info",
        "lineno",
        "funcName",
        "created",
        "msecs",
        "relativeCreated",
        "thread",
        "threadName",
        "processName",
        "process",
        "message",
        "asctime",
    }

    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname.lower(),
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": getattr(record, "request_id", None) or request_id_var.get("-"),
        }
        for key, value in record.__dict__.items():
            if key not in self._reserved and not key.startswith("_") and key not in payload:
                payload[key] = value
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)


def configure_logging() -> None:
    global _configured
    if _configured:
        return
    logger_ = logging.getLogger("naturals")
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    logger_.handlers = [handler]
    logger_.setLevel(os.getenv("LOG_LEVEL", "INFO").upper())
    logger_.propagate = False
    _configured = True


def _truthy(value: str | None) -> bool:
    return (value or "").strip().lower() in {"1", "true", "yes", "on"}


def _client_ip(scope) -> str:
    if _truthy(os.getenv("TRUST_PROXY_HEADERS", "false")):
        for name, value in scope.get("headers", []):
            if name == b"x-forwarded-for":
                return value.split(b",")[0].strip().decode("latin-1") or "unknown"
    client = scope.get("client")
    return client[0] if client else "unknown"


def _request_id(scope) -> str:
    for name, value in scope.get("headers", []):
        if name == b"x-request-id":
            candidate = value.decode("latin-1").strip()
            if candidate and len(candidate) <= 64 and candidate.isprintable():
                return candidate
            break
    return uuid.uuid4().hex


class ObservabilityMiddleware:
    """Pure ASGI middleware so streaming responses are never buffered."""

    def __init__(self, app) -> None:
        self.app = app
        self.access_log = _truthy(os.getenv("ACCESS_LOG_ENABLED", "true"))

    async def __call__(self, scope, receive, send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request_id = _request_id(scope)
        token = request_id_var.set(request_id)
        started = time.perf_counter()
        status_holder = {"status": 500}
        response_started = {"value": False}

        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                response_started["value"] = True
                status_holder["status"] = message.get("status", 500)
                headers = list(message.get("headers", []))
                if not any(name == b"x-request-id" for name, _ in headers):
                    headers.append((b"x-request-id", request_id.encode("latin-1")))
                message["headers"] = headers
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        except Exception:
            metrics.observe_unhandled_error()
            logger.exception(
                "unhandled_exception",
                extra={
                    "request_id": request_id,
                    "method": scope.get("method"),
                    "path": scope.get("path"),
                    "client": _client_ip(scope),
                },
            )
            if response_started["value"]:
                raise
            response = JSONResponse(
                {"detail": "Internal server error.", "request_id": request_id},
                status_code=500,
            )
            status_holder["status"] = 500
            await response(scope, receive, send_wrapper)
        finally:
            duration = time.perf_counter() - started
            route = scope.get("route")
            path = getattr(route, "path", None) or "unmatched"
            method = scope.get("method", "GET")
            status = status_holder["status"]
            metrics.observe_http(method, path, status, duration)
            if self.access_log:
                logger.info(
                    "request",
                    extra={
                        "request_id": request_id,
                        "method": method,
                        "path": path,
                        "status": status,
                        "duration_ms": round(duration * 1000, 2),
                        "client": _client_ip(scope),
                    },
                )
            request_id_var.reset(token)
