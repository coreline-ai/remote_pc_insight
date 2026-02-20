import pytest
from fastapi import HTTPException
from starlette.requests import Request

from app.api.v1.deps import enforce_csrf_for_cookie_request
from app.core.config import settings


def _build_request(*, method: str = "POST", headers: dict[str, str]) -> Request:
    scope = {
        "type": "http",
        "method": method,
        "path": "/v1/tokens/enroll",
        "query_string": b"",
        "headers": [(k.lower().encode("utf-8"), v.encode("utf-8")) for k, v in headers.items()],
        "client": ("127.0.0.1", 43210),
        "scheme": "https",
        "server": ("remote-pc-insight-api.vercel.app", 443),
    }
    return Request(scope)


def test_csrf_allows_origin_valid_without_header_in_production(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(settings, "environment", "production")
    monkeypatch.setattr(settings, "cors_origins", ["https://remote-pc-insight.vercel.app"])
    request = _build_request(
        headers={
            "origin": "https://remote-pc-insight.vercel.app",
            "cookie": "pcinsight_at=token; pcinsight_csrf=csrf_cookie_value",
        }
    )
    enforce_csrf_for_cookie_request(request)


def test_csrf_rejects_invalid_origin_in_production(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(settings, "environment", "production")
    monkeypatch.setattr(settings, "cors_origins", ["https://remote-pc-insight.vercel.app"])
    request = _build_request(
        headers={
            "origin": "https://evil.example",
            "cookie": "pcinsight_at=token; pcinsight_csrf=csrf_cookie_value",
        }
    )
    with pytest.raises(HTTPException) as exc:
        enforce_csrf_for_cookie_request(request)
    assert exc.value.status_code == 403
    assert exc.value.detail == "CSRF origin validation failed"


def test_csrf_rejects_header_cookie_mismatch(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(settings, "environment", "production")
    monkeypatch.setattr(settings, "cors_origins", ["https://remote-pc-insight.vercel.app"])
    request = _build_request(
        headers={
            "origin": "https://remote-pc-insight.vercel.app",
            "x-pcinsight-csrf": "header_value",
            "cookie": "pcinsight_at=token; pcinsight_csrf=cookie_value",
        }
    )
    with pytest.raises(HTTPException) as exc:
        enforce_csrf_for_cookie_request(request)
    assert exc.value.status_code == 403
    assert exc.value.detail == "CSRF token missing or invalid"


def test_csrf_accepts_matching_header_cookie(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(settings, "environment", "production")
    monkeypatch.setattr(settings, "cors_origins", ["https://remote-pc-insight.vercel.app"])
    request = _build_request(
        headers={
            "origin": "https://remote-pc-insight.vercel.app",
            "x-pcinsight-csrf": "same_value",
            "cookie": "pcinsight_at=token; pcinsight_csrf=same_value",
        }
    )
    enforce_csrf_for_cookie_request(request)
