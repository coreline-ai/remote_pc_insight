from datetime import datetime, timezone, timedelta
from typing import List

from fastapi import APIRouter, Depends

from app.api.v1.deps import get_current_user
from app.core.config import settings
from app.core.database import get_connection
from app.models import (
    AiMetricsResponse,
    AiQueryItem,
    AiQueryRequest,
    AiQueryResponse,
    AiVersionInfoResponse,
    AiVersionUsageItem,
)
from app.services.ai_runtime import get_model_version_tag, resolve_ai_provider
from app.services.ai_guardrails import get_ai_metrics_snapshot

router = APIRouter()


def _intent_from_query(query: str) -> str:
    text = query.lower()
    if "오프라인" in query or "offline" in text:
        return "offline_devices"
    if "디스크" in query or "storage" in text:
        return "low_disk"
    if "위험" in query or "risk" in text:
        return "high_risk_devices"
    return "high_risk_devices"


@router.get("/metrics", response_model=AiMetricsResponse)
async def get_ai_metrics(
    current_user: dict = Depends(get_current_user),
):
    metrics = get_ai_metrics_snapshot(scope_key=f"user:{current_user['id']}")
    return AiMetricsResponse(**metrics)


@router.get("/versions", response_model=AiVersionInfoResponse)
async def get_ai_versions(
    current_user: dict = Depends(get_current_user),
):
    _ = current_user
    usages: List[AiVersionUsageItem] = []

    async with get_connection() as conn:
        rows = await conn.fetch(
            """
            SELECT prompt_version, model_version, COUNT(*)::int AS count
            FROM ai_insights
            WHERE user_id = $1
              AND generated_at > NOW() - INTERVAL '30 days'
            GROUP BY prompt_version, model_version
            ORDER BY count DESC
            """,
            current_user["id"],
        )
        for row in rows:
            model_version = str(row["model_version"] or "")
            # Legacy rows written before provider/model tagging are noise on the UI.
            if not model_version or model_version == "default":
                continue
            usages.append(
                AiVersionUsageItem(
                    prompt_version=row["prompt_version"],
                    model_version=model_version,
                    count=row["count"],
                )
            )

    return AiVersionInfoResponse(
        active_prompt_version=settings.ai_prompt_version,
        active_model_version=get_model_version_tag(resolve_ai_provider()),
        usages=usages,
    )


@router.post("/query", response_model=AiQueryResponse)
async def query_ai_insights(
    request: AiQueryRequest,
    current_user: dict = Depends(get_current_user),
):
    intent = _intent_from_query(request.query)

    items: List[AiQueryItem] = []
    answer = "조건에 맞는 디바이스를 찾지 못했습니다."

    async with get_connection() as conn:
        if intent == "offline_devices":
            rows = await conn.fetch(
                """
                SELECT id, name, last_seen_at
                FROM devices
                WHERE user_id = $1
                ORDER BY last_seen_at ASC NULLS FIRST
                LIMIT $2
                """,
                current_user["id"],
                request.limit,
            )
            now = datetime.now(timezone.utc)
            for row in rows:
                last_seen = row["last_seen_at"]
                is_offline = not last_seen or (now - last_seen) > timedelta(minutes=2)
                if is_offline:
                    items.append(
                        AiQueryItem(
                            device_id=row["id"],
                            device_name=row["name"],
                            score=70,
                            reason="최근 2분 내 heartbeat가 확인되지 않았습니다.",
                        )
                    )
        elif intent == "low_disk":
            rows = await conn.fetch(
                """
                SELECT d.id, d.name, r.disk_free_percent
                FROM devices d
                JOIN LATERAL (
                    SELECT disk_free_percent
                    FROM reports
                    WHERE device_id = d.id
                    ORDER BY created_at DESC
                    LIMIT 1
                ) r ON TRUE
                WHERE d.user_id = $1
                ORDER BY r.disk_free_percent ASC
                LIMIT $2
                """,
                current_user["id"],
                request.limit,
            )
            for row in rows:
                disk = row["disk_free_percent"]
                score = int(max(0, min(100, 100 - (disk or 0))))
                items.append(
                    AiQueryItem(
                        device_id=row["id"],
                        device_name=row["name"],
                        score=score,
                        reason=f"디스크 여유 공간 {disk:.1f}%로 낮은 편입니다.",
                    )
                )
        else:
            rows = await conn.fetch(
                """
                SELECT d.id, d.name, d.last_seen_at,
                       r.health_score, r.disk_free_percent, r.startup_apps_count
                FROM devices d
                LEFT JOIN LATERAL (
                    SELECT health_score, disk_free_percent, startup_apps_count
                    FROM reports
                    WHERE device_id = d.id
                    ORDER BY created_at DESC
                    LIMIT 1
                ) r ON TRUE
                WHERE d.user_id = $1
                LIMIT 50
                """,
                current_user["id"],
            )
            now = datetime.now(timezone.utc)
            scored = []
            for row in rows:
                risk = 0
                reasons = []
                if row["health_score"] is not None and row["health_score"] < 60:
                    risk += 40
                    reasons.append("건강 점수 낮음")
                if row["disk_free_percent"] is not None and row["disk_free_percent"] < 20:
                    risk += 35
                    reasons.append("디스크 여유 부족")
                if row["startup_apps_count"] is not None and row["startup_apps_count"] >= 40:
                    risk += 10
                    reasons.append("시작프로그램 과다")
                is_offline = not row["last_seen_at"] or (now - row["last_seen_at"]) > timedelta(minutes=2)
                if is_offline:
                    risk += 10
                    reasons.append("오프라인 상태")
                scored.append((risk, row["id"], row["name"], reasons))
            scored.sort(key=lambda x: x[0], reverse=True)
            for risk, device_id, name, reasons in scored[: request.limit]:
                items.append(
                    AiQueryItem(
                        device_id=device_id,
                        device_name=name,
                        score=risk,
                        reason=", ".join(reasons) if reasons else "기본 점검 필요",
                    )
                )

    if items:
        answer = f"요청 조건에 맞는 디바이스 {len(items)}대를 찾았습니다."

    return AiQueryResponse(
        query=request.query,
        intent=intent,
        answer=answer,
        items=items,
    )
