from contextlib import asynccontextmanager
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest

from app.api.v1.deps import get_current_user
from app.core.config import settings
from app.main import app
from app.models import DeviceAiRecommendedAction, DeviceAiSummaryResponse


class MockConnection:
    def __init__(self):
        self.fetchrow = AsyncMock()
        self.execute = AsyncMock()
        self.fetch = AsyncMock(return_value=[])


@pytest.mark.anyio
async def test_ai_summary_disabled_returns_notice(client, monkeypatch):
    mock_conn = MockConnection()
    mock_conn.fetchrow.side_effect = [
        {"id": "dev_1", "last_seen_at": datetime.now(timezone.utc)},
        {
            "id": "rpt_1",
            "health_score": 90,
            "disk_free_percent": 50.0,
            "startup_apps_count": 5,
            "one_liner": "정상 상태",
            "created_at": datetime.now(timezone.utc),
        },
    ]

    @asynccontextmanager
    async def mock_get_connection():
        yield mock_conn

    monkeypatch.setattr(settings, "enable_ai_copilot", False)
    app.dependency_overrides[get_current_user] = lambda: {"id": "usr_1", "email": "test@example.com"}

    with patch("app.api.v1.routers.devices.get_connection", side_effect=mock_get_connection):
        response = await client.get("/v1/devices/dev_1/ai-summary?provider=openai")

    assert response.status_code == 200
    body = response.json()
    assert body["enabled"] is False
    assert body["source"] == "disabled"
    assert "비활성화" in body["summary"]
    app.dependency_overrides = {}


@pytest.mark.anyio
async def test_ai_summary_enabled_high_risk_recommends_full_scan(client, monkeypatch):
    mock_conn = MockConnection()
    mock_conn.fetchrow.side_effect = [
        {"id": "dev_1", "last_seen_at": datetime.now(timezone.utc)},
        {
            "id": "rpt_2",
            "health_score": 45,
            "disk_free_percent": 9.5,
            "startup_apps_count": 48,
            "one_liner": "디스크 정리가 시급합니다.",
            "created_at": datetime.now(timezone.utc),
        },
        None,
    ]

    @asynccontextmanager
    async def mock_get_connection():
        yield mock_conn

    monkeypatch.setattr(settings, "enable_ai_copilot", True)
    app.dependency_overrides[get_current_user] = lambda: {"id": "usr_1", "email": "test@example.com"}

    with patch("app.api.v1.routers.devices.get_connection", side_effect=mock_get_connection):
        response = await client.get("/v1/devices/dev_1/ai-summary?provider=openai")

    assert response.status_code == 200
    body = response.json()
    assert body["enabled"] is True
    assert body["source"] == "rule_based"
    assert body["risk_level"] == "high"
    assert any(action["command_type"] == "RUN_FULL" for action in body["recommended_actions"])
    assert mock_conn.execute.await_count >= 1
    app.dependency_overrides = {}


@pytest.mark.anyio
async def test_ai_summary_returns_fallback_when_builder_fails(client, monkeypatch):
    mock_conn = MockConnection()
    mock_conn.fetchrow.side_effect = [
        {"id": "dev_1", "last_seen_at": datetime.now(timezone.utc)},
        {
            "id": "rpt_3",
            "health_score": 70,
            "disk_free_percent": 30.0,
            "startup_apps_count": 10,
            "one_liner": "중간 상태",
            "created_at": datetime.now(timezone.utc),
        },
        None,
    ]

    @asynccontextmanager
    async def mock_get_connection():
        yield mock_conn

    monkeypatch.setattr(settings, "enable_ai_copilot", True)
    app.dependency_overrides[get_current_user] = lambda: {"id": "usr_1", "email": "test@example.com"}

    with patch("app.api.v1.routers.devices.get_connection", side_effect=mock_get_connection):
        with patch("app.api.v1.routers.devices.build_device_ai_summary", side_effect=RuntimeError("boom")):
            response = await client.get("/v1/devices/dev_1/ai-summary?provider=openai")

    assert response.status_code == 200
    body = response.json()
    assert body["enabled"] is True
    assert body["source"] == "fallback"
    assert body["risk_level"] == "unknown"
    assert "실패" in body["summary"]
    app.dependency_overrides = {}


@pytest.mark.anyio
async def test_ai_summary_returns_cached_value_when_available(client, monkeypatch):
    mock_conn = MockConnection()
    now = datetime.now(timezone.utc)
    mock_conn.fetchrow.side_effect = [
        {"id": "dev_1", "last_seen_at": now},
        {
            "id": "rpt_cached",
            "health_score": 88,
            "disk_free_percent": 42.0,
            "startup_apps_count": 8,
            "one_liner": "양호",
            "created_at": now,
        },
        {
            "source": "rule_based",
            "summary": "캐시된 AI 요약입니다.",
            "risk_level": "low",
            "reasons_json": ["캐시 재사용"],
            "actions_json": [
                {"command_type": "PING", "label": "연결 확인(PING)", "reason": "캐시 액션"},
            ],
            "report_id": "rpt_cached",
            "generated_at": now,
        },
    ]

    @asynccontextmanager
    async def mock_get_connection():
        yield mock_conn

    monkeypatch.setattr(settings, "enable_ai_copilot", True)
    app.dependency_overrides[get_current_user] = lambda: {"id": "usr_1", "email": "test@example.com"}

    with patch("app.api.v1.routers.devices.get_connection", side_effect=mock_get_connection):
        with patch("app.api.v1.routers.devices.build_device_ai_summary", side_effect=RuntimeError("should not run")):
            response = await client.get("/v1/devices/dev_1/ai-summary?provider=openai")

    assert response.status_code == 200
    body = response.json()
    assert body["summary"] == "운영자 요약: 캐시된 AI 요약입니다."
    assert body["source"] == "rule_based"
    assert body["risk_level"] == "low"
    assert body["reasons"] == ["즉시 실행 가능한 점검 순서로 정리했습니다.", "캐시 재사용"]
    assert len(body["recommended_actions"]) == 1
    assert mock_conn.execute.await_count == 0
    app.dependency_overrides = {}


@pytest.mark.anyio
async def test_ai_summary_supports_provider_query(client, monkeypatch):
    mock_conn = MockConnection()
    mock_conn.fetchrow.side_effect = [
        {"id": "dev_1", "last_seen_at": datetime.now(timezone.utc)},
        {
            "id": "rpt_provider",
            "health_score": 75,
            "disk_free_percent": 35.0,
            "startup_apps_count": 12,
            "one_liner": "provider test",
            "created_at": datetime.now(timezone.utc),
        },
        None,
    ]

    @asynccontextmanager
    async def mock_get_connection():
        yield mock_conn

    monkeypatch.setattr(settings, "enable_ai_copilot", True)
    monkeypatch.setattr(settings, "glm_api_key", "")
    app.dependency_overrides[get_current_user] = lambda: {"id": "usr_1", "email": "test@example.com"}

    with patch("app.api.v1.routers.devices.get_connection", side_effect=mock_get_connection):
        response = await client.get("/v1/devices/dev_1/ai-summary?provider=glm45")

    assert response.status_code == 200
    body = response.json()
    assert body["source"] == "rule_based"
    app.dependency_overrides = {}


@pytest.mark.anyio
async def test_ai_summary_manager_view_does_not_overwrite_cache(client, monkeypatch):
    mock_conn = MockConnection()
    now = datetime.now(timezone.utc)
    mock_conn.fetchrow.side_effect = [
        {"id": "dev_1", "last_seen_at": now},
        {
            "id": "rpt_manager",
            "health_score": 80,
            "disk_free_percent": 35.0,
            "startup_apps_count": 10,
            "one_liner": "manager test",
            "created_at": now,
        },
    ]

    @asynccontextmanager
    async def mock_get_connection():
        yield mock_conn

    monkeypatch.setattr(settings, "enable_ai_copilot", True)
    app.dependency_overrides[get_current_user] = lambda: {"id": "usr_1", "email": "test@example.com"}

    manager_summary = DeviceAiSummaryResponse(
        enabled=True,
        source="rule_based",
        summary="관리자용 테스트 요약",
        risk_level="medium",
        reasons=["테스트"],
        recommended_actions=[
            DeviceAiRecommendedAction(
                command_type="RUN_FULL",
                label="전체 점검",
                reason="테스트 사유",
            )
        ],
        based_on_report_id="rpt_manager",
        generated_at=now,
    )

    mocked_generate = AsyncMock(return_value=manager_summary)
    with patch("app.api.v1.routers.devices.get_connection", side_effect=mock_get_connection):
        with patch("app.api.v1.routers.devices.generate_device_ai_summary", new=mocked_generate):
            response = await client.get("/v1/devices/dev_1/ai-summary?provider=openai&audience=manager")

    assert response.status_code == 200
    body = response.json()
    assert body["summary"] == "관리자용 테스트 요약"
    assert mocked_generate.await_count == 1
    assert mocked_generate.await_args.kwargs["audience"] == "manager"
    assert mock_conn.execute.await_count == 0
    app.dependency_overrides = {}
