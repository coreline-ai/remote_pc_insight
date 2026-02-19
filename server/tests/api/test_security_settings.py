import pytest

from app.core.config import settings, validate_security_settings


def _apply_secure_baseline(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "environment", "production")
    monkeypatch.setattr(settings, "jwt_secret", "x" * 48)
    monkeypatch.setattr(settings, "auth_cookie_secure", True)
    monkeypatch.setattr(settings, "enable_api_docs", False)
    monkeypatch.setattr(settings, "mvp_test_login_enabled", False)
    monkeypatch.setattr(settings, "cors_origins", ["https://pc-insight.example.com"])
    monkeypatch.setattr(settings, "trusted_hosts", ["pc-insight-api.vercel.app"])


def test_validate_security_settings_rejects_insecure_secret(monkeypatch: pytest.MonkeyPatch):
    _apply_secure_baseline(monkeypatch)
    monkeypatch.setattr(settings, "jwt_secret", "change-me-in-production")
    with pytest.raises(RuntimeError):
        validate_security_settings()


def test_validate_security_settings_requires_secure_cookie(monkeypatch: pytest.MonkeyPatch):
    _apply_secure_baseline(monkeypatch)
    monkeypatch.setattr(settings, "auth_cookie_secure", False)
    with pytest.raises(RuntimeError):
        validate_security_settings()


def test_validate_security_settings_requires_docs_off(monkeypatch: pytest.MonkeyPatch):
    _apply_secure_baseline(monkeypatch)
    monkeypatch.setattr(settings, "enable_api_docs", True)
    with pytest.raises(RuntimeError):
        validate_security_settings()


def test_validate_security_settings_requires_mvp_test_login_off(monkeypatch: pytest.MonkeyPatch):
    _apply_secure_baseline(monkeypatch)
    monkeypatch.setattr(settings, "mvp_test_login_enabled", True)
    with pytest.raises(RuntimeError):
        validate_security_settings()


def test_validate_security_settings_allows_safe_production(monkeypatch: pytest.MonkeyPatch):
    _apply_secure_baseline(monkeypatch)
    validate_security_settings()


def test_validate_security_settings_rejects_localhost_only_cors(monkeypatch: pytest.MonkeyPatch):
    _apply_secure_baseline(monkeypatch)
    monkeypatch.setattr(settings, "cors_origins", ["http://localhost:3001"])
    with pytest.raises(RuntimeError):
        validate_security_settings()


def test_validate_security_settings_rejects_localhost_only_trusted_hosts(monkeypatch: pytest.MonkeyPatch):
    _apply_secure_baseline(monkeypatch)
    monkeypatch.setattr(settings, "trusted_hosts", ["localhost", "127.0.0.1"])
    with pytest.raises(RuntimeError):
        validate_security_settings()
