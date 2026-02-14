from __future__ import annotations

import time
from collections import deque
from threading import Lock
from typing import Deque, Dict, Optional

from fastapi import HTTPException, Request, status

from app.core.config import settings

_REQUEST_BUCKETS: Dict[str, Deque[float]] = {}
_REQUEST_LOCK = Lock()
_REDIS_CLIENT: Optional[object] = None
_REDIS_IMPORT_ERROR = False


def _client_id(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for")
    if settings.trust_proxy_headers and forwarded_for:
        return forwarded_for.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


async def _get_redis_client():
    global _REDIS_CLIENT, _REDIS_IMPORT_ERROR
    if _REDIS_CLIENT is not None:
        return _REDIS_CLIENT
    if _REDIS_IMPORT_ERROR or not settings.redis_url:
        return None
    try:
        from redis import asyncio as redis_asyncio  # type: ignore
    except Exception:
        _REDIS_IMPORT_ERROR = True
        return None
    _REDIS_CLIENT = redis_asyncio.from_url(settings.redis_url, decode_responses=True)
    return _REDIS_CLIENT


def _allow_in_memory(key: str, limit: int, window_seconds: int) -> bool:
    now = time.monotonic()
    with _REQUEST_LOCK:
        bucket = _REQUEST_BUCKETS.get(key)
        if bucket is None:
            bucket = deque()
            _REQUEST_BUCKETS[key] = bucket

        while bucket and (now - bucket[0]) > window_seconds:
            bucket.popleft()

        if len(bucket) >= limit:
            return False

        bucket.append(now)
        return True


async def allow_rate_limit_key(*, scope_key: str, limit: int, window_seconds: int = 60) -> bool:
    redis_client = await _get_redis_client()
    if redis_client is not None:
        try:
            bucket = int(time.time()) // window_seconds
            redis_key = f"{settings.redis_rate_limit_prefix}:{scope_key}:{bucket}"
            count = await redis_client.incr(redis_key)
            if count == 1:
                await redis_client.expire(redis_key, window_seconds + 1)
            return count <= limit
        except Exception:
            # Fallback to process-local limiter if redis is unavailable at runtime.
            pass
    return _allow_in_memory(scope_key, limit, window_seconds)


async def enforce_request_rate_limit(
    *,
    request: Request,
    scope: str,
    limit: int | None = None,
    window_seconds: int | None = None,
) -> None:
    max_requests = limit or settings.rate_limit_requests
    window = window_seconds or settings.rate_limit_window_seconds
    key = f"{scope}:{_client_id(request)}"
    if not await allow_rate_limit_key(scope_key=key, limit=max_requests, window_seconds=window):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Please try again later.",
        )
