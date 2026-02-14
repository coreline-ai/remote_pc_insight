from __future__ import annotations

from threading import Lock
from typing import Dict, Optional

from app.services.request_rate_limit import allow_rate_limit_key


_METRICS = {
    "requests_total": 0,
    "requests_success": 0,
    "requests_failed": 0,
    "requests_rate_limited": 0,
    "fallback_total": 0,
}
_METRICS_LOCK = Lock()


async def check_rate_limit(key: str, limit: int, window_seconds: int = 60) -> bool:
    return await allow_rate_limit_key(scope_key=f"ai:{key}", limit=limit, window_seconds=window_seconds)


def record_ai_call(
    *,
    success: bool,
    rate_limited: bool = False,
    fallback_used: bool = False,
) -> None:
    with _METRICS_LOCK:
        _METRICS["requests_total"] += 1
        if success:
            _METRICS["requests_success"] += 1
        else:
            _METRICS["requests_failed"] += 1
        if rate_limited:
            _METRICS["requests_rate_limited"] += 1
        if fallback_used:
            _METRICS["fallback_total"] += 1


def get_ai_metrics_snapshot() -> Dict[str, int]:
    with _METRICS_LOCK:
        return dict(_METRICS)


def classify_ai_error(exc: Exception) -> str:
    message = str(exc).lower()
    if "timeout" in message:
        return "timeout"
    if "429" in message or "rate" in message:
        return "rate_limited"
    if "401" in message or "403" in message:
        return "auth"
    if "invalid json" in message or "parse" in message:
        return "parse"
    return "unknown"
