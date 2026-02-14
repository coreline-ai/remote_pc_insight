from __future__ import annotations

from threading import Lock
from typing import Dict, Optional

from app.services.request_rate_limit import allow_rate_limit_key


def _new_metrics() -> Dict[str, int]:
    return {
        "requests_total": 0,
        "requests_success": 0,
        "requests_failed": 0,
        "requests_rate_limited": 0,
        "fallback_total": 0,
    }


_METRICS = _new_metrics()
_METRICS_BY_SCOPE: Dict[str, Dict[str, int]] = {}
_METRICS_LOCK = Lock()


async def check_rate_limit(key: str, limit: int, window_seconds: int = 60) -> bool:
    return await allow_rate_limit_key(scope_key=f"ai:{key}", limit=limit, window_seconds=window_seconds)


def record_ai_call(
    *,
    success: bool,
    rate_limited: bool = False,
    fallback_used: bool = False,
    scope_key: Optional[str] = None,
) -> None:
    def _apply(bucket: Dict[str, int]) -> None:
        bucket["requests_total"] += 1
        if success:
            bucket["requests_success"] += 1
        else:
            bucket["requests_failed"] += 1
        if rate_limited:
            bucket["requests_rate_limited"] += 1
        if fallback_used:
            bucket["fallback_total"] += 1

    with _METRICS_LOCK:
        _apply(_METRICS)
        if scope_key:
            scoped = _METRICS_BY_SCOPE.get(scope_key)
            if scoped is None:
                scoped = _new_metrics()
                _METRICS_BY_SCOPE[scope_key] = scoped
            _apply(scoped)


def get_ai_metrics_snapshot(scope_key: Optional[str] = None) -> Dict[str, int]:
    with _METRICS_LOCK:
        if not scope_key:
            return dict(_METRICS)
        return dict(_METRICS_BY_SCOPE.get(scope_key, _new_metrics()))


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
