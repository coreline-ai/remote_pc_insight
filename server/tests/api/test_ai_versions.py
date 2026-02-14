from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, patch

import pytest

from app.api.v1.deps import get_current_user
from app.core.config import settings
from app.main import app


class MockConnection:
    def __init__(self):
        self.fetch = AsyncMock()


@pytest.mark.anyio
async def test_ai_versions_endpoint_returns_active_and_usage(client, monkeypatch):
    mock_conn = MockConnection()
    mock_conn.fetch.return_value = [
        {"prompt_version": "v2", "model_version": "gpt-4o-mini-2026-01", "count": 7},
        {"prompt_version": "v1", "model_version": "gpt-4o-mini", "count": 3},
    ]

    @asynccontextmanager
    async def mock_get_connection():
        yield mock_conn

    monkeypatch.setattr(settings, "ai_prompt_version", "v2")
    monkeypatch.setattr(settings, "ai_provider", "openai")
    monkeypatch.setattr(settings, "openai_model", "gpt-4o-mini")
    monkeypatch.setattr(settings, "ai_model_version", "gpt-4o-mini-2026-01")
    app.dependency_overrides[get_current_user] = lambda: {"id": "usr_1", "email": "test@example.com"}

    with patch("app.api.v1.routers.ai.get_connection", side_effect=mock_get_connection):
        response = await client.get("/v1/ai/versions")

    assert response.status_code == 200
    body = response.json()
    assert body["active_prompt_version"] == "v2"
    assert body["active_model_version"] == "openai:gpt-4o-mini:gpt-4o-mini-2026-01"
    assert len(body["usages"]) == 2
    assert body["usages"][0]["count"] == 7
    app.dependency_overrides = {}


@pytest.mark.anyio
async def test_ai_versions_filters_legacy_default_model_rows(client, monkeypatch):
    mock_conn = MockConnection()
    mock_conn.fetch.return_value = [
        {"prompt_version": "v1", "model_version": "default", "count": 9},
        {"prompt_version": "v1", "model_version": "glm45:GLM-4.6:default", "count": 2},
    ]

    @asynccontextmanager
    async def mock_get_connection():
        yield mock_conn

    monkeypatch.setattr(settings, "ai_prompt_version", "v1")
    monkeypatch.setattr(settings, "ai_provider", "glm45")
    monkeypatch.setattr(settings, "glm_model", "GLM-4.6")
    monkeypatch.setattr(settings, "ai_model_version", "default")
    app.dependency_overrides[get_current_user] = lambda: {"id": "usr_1", "email": "test@example.com"}

    with patch("app.api.v1.routers.ai.get_connection", side_effect=mock_get_connection):
        response = await client.get("/v1/ai/versions")

    assert response.status_code == 200
    body = response.json()
    assert body["active_model_version"] == "glm45:GLM-4.6:default"
    assert len(body["usages"]) == 1
    assert body["usages"][0]["model_version"] == "glm45:GLM-4.6:default"
    app.dependency_overrides = {}
