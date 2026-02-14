from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest

from app.core.config import settings
from app.models import DeviceAiSummaryResponse
from app.services.ai_runtime import generate_device_ai_summary


def _rule_based() -> DeviceAiSummaryResponse:
    return DeviceAiSummaryResponse(
        enabled=True,
        source="rule_based",
        summary="기본 요약",
        risk_level="medium",
        reasons=["기본 이유"],
        recommended_actions=[],
        based_on_report_id=None,
        generated_at=datetime.now(timezone.utc),
    )


@pytest.mark.anyio
async def test_generate_ai_summary_rate_limited(monkeypatch):
    monkeypatch.setattr(settings, "enable_ai_copilot", True)
    monkeypatch.setattr(settings, "openai_api_key", "sk-test")
    with patch("app.services.ai_runtime.check_rate_limit", new=AsyncMock(return_value=False)):
        result = await generate_device_ai_summary(
            is_online=True,
            latest_report=None,
            rule_based=_rule_based(),
            rate_limit_key="user:1",
            trace_id="t1",
        )
    assert result.source == "rate_limited"


@pytest.mark.anyio
async def test_generate_ai_summary_without_api_key(monkeypatch):
    monkeypatch.setattr(settings, "enable_ai_copilot", True)
    monkeypatch.setattr(settings, "openai_api_key", "")
    monkeypatch.setattr(settings, "ai_provider", "openai")
    with patch("app.services.ai_runtime.check_rate_limit", new=AsyncMock(return_value=True)):
        result = await generate_device_ai_summary(
            is_online=True,
            latest_report=None,
            rule_based=_rule_based(),
            rate_limit_key="user:1",
            trace_id="t2",
            provider="openai",
        )
    assert result.source == "rule_based"


@pytest.mark.anyio
async def test_generate_ai_summary_fallback_on_adapter_error(monkeypatch):
    monkeypatch.setattr(settings, "enable_ai_copilot", True)
    monkeypatch.setattr(settings, "openai_api_key", "sk-test")
    with patch("app.services.ai_runtime.check_rate_limit", new=AsyncMock(return_value=True)):
        with patch("app.services.ai_runtime._call_provider_chat", side_effect=RuntimeError("openai 500")):
            result = await generate_device_ai_summary(
                is_online=True,
                latest_report={"health_score": 70},
                rule_based=_rule_based(),
                rate_limit_key="user:1",
                trace_id="t3",
            )
    assert result.source == "fallback"


@pytest.mark.anyio
async def test_generate_ai_summary_without_glm_api_key(monkeypatch):
    monkeypatch.setattr(settings, "enable_ai_copilot", True)
    monkeypatch.setattr(settings, "glm_api_key", "")
    with patch("app.services.ai_runtime.check_rate_limit", new=AsyncMock(return_value=True)):
        result = await generate_device_ai_summary(
            is_online=True,
            latest_report=None,
            rule_based=_rule_based(),
            rate_limit_key="user:1",
            trace_id="t4",
            provider="glm45",
        )
    assert result.source == "rule_based"


@pytest.mark.anyio
async def test_generate_ai_summary_applies_manager_view(monkeypatch):
    monkeypatch.setattr(settings, "enable_ai_copilot", True)
    monkeypatch.setattr(settings, "openai_api_key", "")
    monkeypatch.setattr(settings, "ai_provider", "openai")
    with patch("app.services.ai_runtime.check_rate_limit", new=AsyncMock(return_value=True)):
        result = await generate_device_ai_summary(
            is_online=True,
            latest_report=None,
            rule_based=_rule_based(),
            rate_limit_key="user:1",
            trace_id="t5",
            provider="openai",
            audience="manager",
        )
    assert result.source == "rule_based"
    assert result.summary.startswith("관리자 요약:")
    assert any(reason.startswith("업무 영향 관점") for reason in result.reasons)
