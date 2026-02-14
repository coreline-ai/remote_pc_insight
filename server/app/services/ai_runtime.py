from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import httpx

from app.core.config import settings
from app.models import DeviceAiRecommendedAction, DeviceAiSummaryResponse
from app.services.ai_guardrails import (
    check_rate_limit,
    classify_ai_error,
    record_ai_call,
)

logger = logging.getLogger(__name__)
SUPPORTED_AI_PROVIDERS = {"openai", "glm45"}

SYSTEM_PROMPT = (
    "You are an IT operations copilot. "
    "Return strict JSON only with keys: summary, risk_level, reasons, recommended_actions. "
    "risk_level must be one of: low, medium, high, unknown. "
    "recommended_actions must contain command_type, label, reason. "
    "Allowed command_type: RUN_FULL, RUN_STORAGE_ONLY, PING."
)


def _sanitize_report(latest_report: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if not latest_report:
        return {}
    return {
        "health_score": latest_report.get("health_score"),
        "disk_free_percent": latest_report.get("disk_free_percent"),
        "startup_apps_count": latest_report.get("startup_apps_count"),
        "one_liner": latest_report.get("one_liner"),
        "created_at": str(latest_report.get("created_at")),
    }


def _build_user_prompt(
    *,
    is_online: bool,
    latest_report: Optional[Dict[str, Any]],
    rule_based: DeviceAiSummaryResponse,
) -> str:
    payload = {
        "device_online": is_online,
        "latest_report": _sanitize_report(latest_report),
        "rule_based_baseline": {
            "summary": rule_based.summary,
            "risk_level": rule_based.risk_level,
            "reasons": rule_based.reasons,
            "recommended_actions": [action.model_dump() for action in rule_based.recommended_actions],
        },
        "constraints": {
            "no_sensitive_data": True,
            "max_reasons": 4,
            "max_actions": 3,
        },
    }
    text = json.dumps(payload, ensure_ascii=False)
    return text[: settings.ai_max_prompt_chars]


def _normalize_actions(actions: List[Dict[str, Any]]) -> List[DeviceAiRecommendedAction]:
    allowed = {"RUN_FULL", "RUN_STORAGE_ONLY", "PING"}
    normalized: List[DeviceAiRecommendedAction] = []
    for raw in actions[:3]:
        command_type = str(raw.get("command_type", "")).strip()
        if command_type not in allowed:
            continue
        normalized.append(
            DeviceAiRecommendedAction(
                command_type=command_type,
                label=str(raw.get("label", command_type)),
                reason=str(raw.get("reason", "권장 점검 액션입니다.")),
            )
        )
    return normalized


def apply_audience_view(
    summary: DeviceAiSummaryResponse,
    *,
    audience: str,
    is_online: bool,
) -> DeviceAiSummaryResponse:
    if audience == "manager":
        prefix = "관리자 요약: "
        action_prefix = "승인/지시: "
        view_reason = (
            "업무 영향 관점 우선순위를 반영했습니다."
            if is_online
            else "오프라인 상태로 업무 영향 위험이 커 우선 확인이 필요합니다."
        )
    else:
        prefix = "운영자 요약: "
        action_prefix = ""
        view_reason = "즉시 실행 가능한 점검 순서로 정리했습니다."

    summary_text = summary.summary.strip()
    if summary_text and not summary_text.startswith(prefix):
        summary_text = f"{prefix}{summary_text}"

    reasons = list(summary.reasons)
    if view_reason not in reasons:
        reasons = [view_reason, *reasons]

    shaped_actions: List[DeviceAiRecommendedAction] = []
    for action in summary.recommended_actions:
        label = action.label.strip()
        if action_prefix:
            if not label.startswith(action_prefix):
                label = f"{action_prefix}{label}"
        elif label.startswith("승인/지시: "):
            label = label.replace("승인/지시: ", "", 1)

        shaped_actions.append(
            action.model_copy(
                update={
                    "label": label,
                }
            )
        )

    return summary.model_copy(
        update={
            "summary": summary_text[:500],
            "reasons": reasons[:4],
            "recommended_actions": shaped_actions,
        }
    )


def _parse_model_json(content: str) -> Dict[str, Any]:
    content = content.strip()
    if content.startswith("```"):
        lines = content.splitlines()
        content = "\n".join(line for line in lines if not line.startswith("```"))
    try:
        return json.loads(content)
    except Exception as exc:
        raise ValueError("invalid json from model") from exc


def _normalize_provider(value: Optional[str]) -> str:
    candidate = (value or "").strip().lower()
    if candidate in {"glm", "glm4.5", "glm-4.5"}:
        return "glm45"
    return candidate


def resolve_ai_provider(provider: Optional[str] = None) -> str:
    requested = _normalize_provider(provider)
    if requested in SUPPORTED_AI_PROVIDERS:
        return requested

    configured = _normalize_provider(settings.ai_provider)
    if configured in SUPPORTED_AI_PROVIDERS:
        return configured
    return "openai"


def _resolve_chat_endpoint(provider: str, raw_endpoint: str) -> str:
    endpoint = raw_endpoint.strip().rstrip("/")
    if endpoint.endswith("/chat/completions"):
        return endpoint
    if provider == "glm45":
        return f"{endpoint}/chat/completions"
    if provider == "openai" and endpoint.endswith("/v1"):
        return f"{endpoint}/chat/completions"
    return endpoint


def _provider_runtime(provider: str) -> Tuple[str, str, str]:
    if provider == "glm45":
        model = (settings.glm_model or "glm-4.5").strip()
        endpoint = _resolve_chat_endpoint(
            provider,
            settings.glm_base_url or "https://open.bigmodel.cn/api/paas/v4/chat/completions",
        )
        api_key = settings.glm_api_key.strip()
        return model, endpoint, api_key

    model = (settings.openai_model or settings.ai_model or "gpt-4o-mini").strip()
    endpoint = _resolve_chat_endpoint(
        provider,
        settings.openai_base_url or "https://api.openai.com/v1/chat/completions",
    )
    api_key = settings.openai_api_key.strip()
    return model, endpoint, api_key


def get_model_version_tag(provider: Optional[str] = None) -> str:
    resolved = resolve_ai_provider(provider)
    model, _, _ = _provider_runtime(resolved)
    return f"{resolved}:{model}:{settings.ai_model_version}"


def _extract_content(data: Dict[str, Any]) -> str:
    choices = data.get("choices")
    if not isinstance(choices, list) or not choices:
        raise ValueError("invalid model response: choices missing")
    message = choices[0].get("message") or {}
    content = message.get("content")
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: List[str] = []
        for item in content:
            if isinstance(item, dict):
                text = item.get("text")
                if isinstance(text, str):
                    parts.append(text)
        return "\n".join(parts)
    raise ValueError("invalid model response: content missing")


async def _call_provider_chat(provider: str, messages: List[Dict[str, str]], trace_id: str) -> Dict[str, Any]:
    model, endpoint, api_key = _provider_runtime(provider)
    temperature = settings.glm_temperature if provider == "glm45" else 0.2
    payload = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
    }
    if provider == "openai":
        payload["response_format"] = {"type": "json_object"}
    elif provider == "glm45":
        thinking_type = (settings.glm_thinking_type or "").strip()
        if thinking_type:
            payload["thinking"] = {"type": thinking_type}

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "X-Trace-Id": trace_id,
    }
    timeout_seconds = settings.glm_timeout_seconds if provider == "glm45" else settings.ai_timeout_seconds
    timeout = httpx.Timeout(timeout_seconds)
    retries = max(0, settings.ai_max_retries)

    last_error: Optional[Exception] = None
    for _ in range(retries + 1):
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(endpoint, headers=headers, json=payload)
            if response.status_code >= 400:
                raise RuntimeError(f"{provider} http {response.status_code}: {response.text[:200]}")

            data = response.json()
            content = _extract_content(data)
            return _parse_model_json(content)
        except Exception as exc:
            last_error = exc
    assert last_error is not None
    raise last_error


async def generate_device_ai_summary(
    *,
    is_online: bool,
    latest_report: Optional[Dict[str, Any]],
    rule_based: DeviceAiSummaryResponse,
    rate_limit_key: str,
    trace_id: str,
    audience: str = "operator",
    provider: Optional[str] = None,
) -> DeviceAiSummaryResponse:
    if not settings.enable_ai_copilot:
        return apply_audience_view(rule_based, audience=audience, is_online=is_online)

    provider_name = resolve_ai_provider(provider)

    # Guardrail: in-process rate limit
    if not await check_rate_limit(rate_limit_key, settings.ai_rate_limit_per_minute):
        record_ai_call(success=False, rate_limited=True, fallback_used=True)
        fallback = rule_based.model_copy()
        fallback.source = "rate_limited"
        fallback.summary = "AI 요청 한도를 초과했습니다. 기본 권장 액션을 사용하세요."
        fallback.generated_at = datetime.now(timezone.utc)
        return apply_audience_view(fallback, audience=audience, is_online=is_online)

    # Guardrail: key missing -> deterministic fallback
    _, _, api_key = _provider_runtime(provider_name)
    if not api_key:
        record_ai_call(success=False, fallback_used=True)
        fallback = rule_based.model_copy()
        fallback.source = "rule_based"
        fallback.summary = f"{provider_name.upper()} API 키가 없어 기본 규칙 기반 요약을 사용합니다."
        fallback.generated_at = datetime.now(timezone.utc)
        return apply_audience_view(fallback, audience=audience, is_online=is_online)

    style_hint = "운영자 관점으로 간결히" if audience == "operator" else "관리자 관점으로 영향/우선순위를 강조"
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {
            "role": "user",
            "content": f"{style_hint}. 다음 JSON 입력을 바탕으로 JSON만 반환하세요: "
            + _build_user_prompt(is_online=is_online, latest_report=latest_report, rule_based=rule_based),
        },
    ]

    try:
        raw = await _call_provider_chat(provider_name, messages, trace_id)
        risk_level = str(raw.get("risk_level", "unknown")).lower()
        if risk_level not in {"low", "medium", "high", "unknown"}:
            risk_level = "unknown"

        reasons = [str(item) for item in raw.get("reasons", [])][:4]
        actions = _normalize_actions(list(raw.get("recommended_actions", [])))
        if not actions:
            actions = rule_based.recommended_actions[:2]

        record_ai_call(success=True)
        response = DeviceAiSummaryResponse(
            enabled=True,
            source="llm",
            summary=str(raw.get("summary", rule_based.summary))[:500],
            risk_level=risk_level,
            reasons=reasons or rule_based.reasons[:3],
            recommended_actions=actions,
            based_on_report_id=rule_based.based_on_report_id,
            generated_at=datetime.now(timezone.utc),
        )
        return apply_audience_view(response, audience=audience, is_online=is_online)
    except Exception as exc:
        error_type = classify_ai_error(exc)
        logger.warning("AI adapter fallback: trace_id=%s error_type=%s", trace_id, error_type)
        record_ai_call(success=False, fallback_used=True)
        fallback = rule_based.model_copy()
        fallback.source = "fallback"
        fallback.summary = "AI 생성이 실패하여 기본 규칙 기반 요약으로 대체되었습니다."
        fallback.generated_at = datetime.now(timezone.utc)
        return apply_audience_view(fallback, audience=audience, is_online=is_online)
