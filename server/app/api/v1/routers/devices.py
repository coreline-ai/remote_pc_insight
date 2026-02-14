import json
import logging
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from datetime import datetime, timezone, timedelta
from typing import List, Optional

from app.api.v1.deps import get_current_user
from app.core.config import settings
from app.core.database import get_connection
from app.core.security import generate_id
from app.models import (
    DeviceAiRecommendedAction,
    DeviceResponse,
    DeviceListResponse,
    DeviceDetailResponse,
    CommandResponse,
    ReportSummary,
    DeviceAiSummaryResponse,
    DeviceRiskItem,
    DeviceRiskTopResponse,
    DeviceTrendResponse,
    DeviceTrendSignal,
)
from app.services.ai_copilot import build_device_ai_summary
from app.services.ai_runtime import (
    apply_audience_view,
    generate_device_ai_summary,
    get_model_version_tag,
    resolve_ai_provider,
)

router = APIRouter()
logger = logging.getLogger(__name__)


def _compute_risk(row: dict, *, is_online: bool) -> tuple[int, str, List[str]]:
    score = 0
    reasons: List[str] = []
    health_score = row.get("health_score")
    disk_free_percent = row.get("disk_free_percent")
    startup_apps_count = row.get("startup_apps_count")

    if health_score is not None:
        if health_score < 60:
            score += 45
            reasons.append(f"건강 점수 낮음({health_score})")
        elif health_score < 80:
            score += 20
            reasons.append(f"건강 점수 주의({health_score})")
    else:
        score += 20
        reasons.append("리포트 없음")

    if disk_free_percent is not None:
        if disk_free_percent < 15:
            score += 35
            reasons.append(f"디스크 위험({disk_free_percent:.1f}%)")
        elif disk_free_percent < 25:
            score += 15
            reasons.append(f"디스크 부족({disk_free_percent:.1f}%)")

    if startup_apps_count is not None and startup_apps_count >= 40:
        score += 10
        reasons.append(f"시작프로그램 과다({startup_apps_count})")

    if not is_online:
        score += 10
        reasons.append("오프라인 상태")

    score = min(score, 100)
    if score >= 60:
        level = "high"
    elif score >= 30:
        level = "medium"
    else:
        level = "low"
    return score, level, reasons[:3]


async def _rank_actions_by_history(
    *,
    conn,
    device_id: str,
    actions: List[DeviceAiRecommendedAction],
) -> List[DeviceAiRecommendedAction]:
    if not actions:
        return actions

    rows = await conn.fetch(
        """
        SELECT type,
               SUM(CASE WHEN status = 'succeeded' THEN 1 ELSE 0 END) AS success_count,
               COUNT(*) AS total_count
        FROM commands
        WHERE device_id = $1
          AND type IN ('RUN_FULL', 'RUN_STORAGE_ONLY', 'PING')
          AND created_at > NOW() - INTERVAL '30 days'
        GROUP BY type
        """,
        device_id,
    )
    stats = {
        row["type"]: (
            (row["success_count"] / row["total_count"]) if row["total_count"] else 0.5
        )
        for row in rows
    }
    return sorted(actions, key=lambda action: stats.get(action.command_type, 0.5), reverse=True)


def _build_ping_latency_signal(ping_latencies: List[float]) -> Optional[DeviceTrendSignal]:
    if not ping_latencies:
        return None

    latest = ping_latencies[0]
    baseline_samples = ping_latencies[1:] if len(ping_latencies) > 1 else ping_latencies
    baseline = sum(baseline_samples) / len(baseline_samples)
    delta = latest - baseline

    if latest >= 700 or delta >= 120:
        status = "degraded"
        note = "최근 PING 지연이 평균 대비 증가했습니다."
    elif delta <= -120:
        status = "improved"
        note = "최근 PING 지연이 평균 대비 개선되었습니다."
    else:
        status = "stable"
        note = "최근 PING 지연이 평균과 유사합니다."

    return DeviceTrendSignal(
        metric="ping_latency_ms",
        current=round(latest, 1),
        baseline=round(baseline, 1),
        delta=round(delta, 1),
        status=status,
        note=note,
    )


async def _fetch_ping_latency_samples(conn, device_id: str) -> List[float]:
    rows = await conn.fetch(
        """
        SELECT EXTRACT(EPOCH FROM (finished_at - started_at)) * 1000 AS latency_ms
        FROM commands
        WHERE device_id = $1
          AND type = 'PING'
          AND status = 'succeeded'
          AND started_at IS NOT NULL
          AND finished_at IS NOT NULL
          AND finished_at > NOW() - INTERVAL '7 days'
        ORDER BY finished_at DESC
        LIMIT 8
        """,
        device_id,
    )
    return [float(row["latency_ms"]) for row in rows if row["latency_ms"] is not None]


def _build_trend_signals(
    device_id: str,
    reports: List[dict],
    *,
    ping_latencies: Optional[List[float]] = None,
) -> DeviceTrendResponse:
    signals: List[DeviceTrendSignal] = []
    ping_signal = _build_ping_latency_signal(ping_latencies or [])
    if ping_signal:
        signals.append(ping_signal)

    if not reports:
        summary = "최근 7일 리포트가 없어 추세를 계산할 수 없습니다."
        if signals:
            degraded = [signal for signal in signals if signal.status == "degraded"]
            summary = "최근 7일 추세에서 악화 신호가 감지되었습니다." if degraded else "최근 7일 추세는 안정적입니다."
        return DeviceTrendResponse(
            device_id=device_id,
            period_days=7,
            signals=signals,
            summary=summary,
        )

    latest = reports[0]
    baseline_rows = reports[1:] if len(reports) > 1 else reports
    avg_disk = (
        sum(row["disk_free_percent"] for row in baseline_rows if row["disk_free_percent"] is not None)
        / max(1, sum(1 for row in baseline_rows if row["disk_free_percent"] is not None))
    )
    avg_startup = (
        sum(row["startup_apps_count"] for row in baseline_rows if row["startup_apps_count"] is not None)
        / max(1, sum(1 for row in baseline_rows if row["startup_apps_count"] is not None))
    )

    latest_disk = latest.get("disk_free_percent")
    latest_startup = latest.get("startup_apps_count")
    if latest_disk is not None:
        delta = latest_disk - avg_disk
        if delta <= -5:
            status = "degraded"
            note = "디스크 여유가 최근 평균 대비 감소했습니다."
        elif delta >= 5:
            status = "improved"
            note = "디스크 여유가 최근 평균 대비 개선되었습니다."
        else:
            status = "stable"
            note = "디스크 여유가 최근 평균과 유사합니다."
        signals.append(
            DeviceTrendSignal(
                metric="disk_free_percent",
                current=latest_disk,
                baseline=round(avg_disk, 1),
                delta=round(delta, 1),
                status=status,
                note=note,
            )
        )

    if latest_startup is not None:
        delta = latest_startup - avg_startup
        if delta >= 8:
            status = "degraded"
            note = "시작 프로그램 수가 최근 평균 대비 증가했습니다."
        elif delta <= -8:
            status = "improved"
            note = "시작 프로그램 수가 최근 평균 대비 감소했습니다."
        else:
            status = "stable"
            note = "시작 프로그램 수가 최근 평균과 유사합니다."
        signals.append(
            DeviceTrendSignal(
                metric="startup_apps_count",
                current=float(latest_startup),
                baseline=round(avg_startup, 1),
                delta=round(delta, 1),
                status=status,
                note=note,
            )
        )

    degraded = [signal for signal in signals if signal.status == "degraded"]
    summary = "최근 7일 추세는 안정적입니다."
    if degraded:
        summary = "최근 7일 추세에서 악화 신호가 감지되었습니다."

    return DeviceTrendResponse(
        device_id=device_id,
        period_days=7,
        signals=signals,
        summary=summary,
    )


@router.get("", response_model=DeviceListResponse)
async def list_devices(
    current_user: dict = Depends(get_current_user),
):
    """List all devices for the current user."""
    async with get_connection() as conn:
        rows = await conn.fetch("""
            SELECT id, name, platform, arch, agent_version, created_at, last_seen_at, revoked_at
            FROM devices
            WHERE user_id = $1
            ORDER BY last_seen_at DESC NULLS LAST, created_at DESC
        """, current_user["id"])
    
    now = datetime.now(timezone.utc)
    devices = []
    for row in rows:
        last_seen = row["last_seen_at"]
        is_online = last_seen and (now - last_seen) < timedelta(minutes=2)
        
        devices.append(DeviceResponse(
            id=row["id"],
            name=row["name"],
            platform=row["platform"],
            arch=row["arch"],
            agent_version=row["agent_version"],
            created_at=row["created_at"],
            last_seen_at=row["last_seen_at"],
            is_online=is_online,
            is_revoked=row["revoked_at"] is not None,
        ))
    
    return DeviceListResponse(devices=devices, total=len(devices))


@router.get("/risk-top", response_model=DeviceRiskTopResponse)
async def get_risk_top_devices(
    limit: int = Query(default=5, ge=1, le=20),
    current_user: dict = Depends(get_current_user),
):
    async with get_connection() as conn:
        rows = await conn.fetch(
            """
            SELECT d.id, d.name, d.platform, d.last_seen_at,
                   r.id AS report_id, r.created_at AS report_created_at,
                   r.health_score, r.disk_free_percent, r.startup_apps_count
            FROM devices d
            LEFT JOIN LATERAL (
                SELECT id, created_at, health_score, disk_free_percent, startup_apps_count
                FROM reports
                WHERE device_id = d.id
                ORDER BY created_at DESC
                LIMIT 1
            ) r ON TRUE
            WHERE d.user_id = $1
              AND d.revoked_at IS NULL
            """,
            current_user["id"],
        )

    now = datetime.now(timezone.utc)
    items: List[DeviceRiskItem] = []
    for row in rows:
        last_seen = row["last_seen_at"]
        is_online = bool(last_seen and (now - last_seen) < timedelta(minutes=2))
        risk_score, risk_level, reasons = _compute_risk(dict(row), is_online=is_online)
        items.append(
            DeviceRiskItem(
                device_id=row["id"],
                device_name=row["name"],
                platform=row["platform"],
                is_online=is_online,
                risk_score=risk_score,
                risk_level=risk_level,
                top_reasons=reasons,
                latest_report_id=row["report_id"],
                latest_report_at=row["report_created_at"],
            )
        )

    items.sort(key=lambda item: item.risk_score, reverse=True)
    limited = items[:limit]
    return DeviceRiskTopResponse(items=limited, total=len(limited))


@router.get("/{device_id}", response_model=DeviceDetailResponse)
async def get_device(
    device_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get device details with recent commands and latest report."""
    async with get_connection() as conn:
        # Get device
        device = await conn.fetchrow("""
            SELECT id, name, platform, arch, agent_version, created_at, last_seen_at, revoked_at
            FROM devices
            WHERE id = $1 AND user_id = $2
        """, device_id, current_user["id"])
        
        if not device:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Device not found",
            )
        
        # Get recent commands
        commands = await conn.fetch("""
            SELECT id, type, status, progress, message, created_at, started_at, finished_at, report_id
            FROM commands
            WHERE device_id = $1
            ORDER BY created_at DESC
            LIMIT 10
        """, device_id)
        
        # Get latest report
        report = await conn.fetchrow("""
            SELECT id, health_score, disk_free_percent, startup_apps_count, one_liner, created_at
            FROM reports
            WHERE device_id = $1
            ORDER BY created_at DESC
            LIMIT 1
        """, device_id)
    
    now = datetime.now(timezone.utc)
    last_seen = device["last_seen_at"]
    is_online = last_seen and (now - last_seen) < timedelta(minutes=2)
    
    return DeviceDetailResponse(
        id=device["id"],
        name=device["name"],
        platform=device["platform"],
        arch=device["arch"],
        agent_version=device["agent_version"],
        created_at=device["created_at"],
        last_seen_at=device["last_seen_at"],
        is_online=is_online,
        is_revoked=device["revoked_at"] is not None,
        recent_commands=[
            CommandResponse(
                id=cmd["id"],
                type=cmd["type"],
                status=cmd["status"],
                progress=cmd["progress"],
                message=cmd["message"],
                created_at=cmd["created_at"],
                started_at=cmd["started_at"],
                finished_at=cmd["finished_at"],
                report_id=cmd["report_id"],
            )
            for cmd in commands
        ],
        latest_report=ReportSummary(
            id=report["id"],
            health_score=report["health_score"],
            disk_free_percent=report["disk_free_percent"],
            startup_apps_count=report["startup_apps_count"],
            one_liner=report["one_liner"],
            created_at=report["created_at"],
        ) if report else None,
    )


@router.get("/{device_id}/ai-summary", response_model=DeviceAiSummaryResponse)
async def get_device_ai_summary(
    device_id: str,
    request: Request,
    audience: str = Query(default="operator", pattern="^(operator|manager)$"),
    provider: str = Query(default="glm45", pattern="^(openai|glm45|glm4\\.5|glm-4\\.5|glm)$"),
    current_user: dict = Depends(get_current_user),
):
    """Get AI copilot summary for a device based on latest report."""
    provider_name = resolve_ai_provider(provider)
    cache_model_version = get_model_version_tag(provider_name)
    cache_prompt_version = settings.ai_prompt_version

    async with get_connection() as conn:
        device = await conn.fetchrow(
            """
            SELECT id, last_seen_at
            FROM devices
            WHERE id = $1 AND user_id = $2
            """,
            device_id,
            current_user["id"],
        )
        if not device:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Device not found",
            )

        report = await conn.fetchrow(
            """
            SELECT id, health_score, disk_free_percent, startup_apps_count, one_liner, created_at
            FROM reports
            WHERE device_id = $1
            ORDER BY created_at DESC
            LIMIT 1
            """,
            device_id,
        )

        # Return cached insight if available for latest report
        cached = None
        if settings.enable_ai_copilot and report and audience == "operator":
            cached = await conn.fetchrow(
                """
                SELECT source, summary, risk_level, reasons_json, actions_json, report_id, generated_at,
                       prompt_version, model_version
                FROM ai_insights
                WHERE device_id = $1
                  AND report_id = $2
                  AND prompt_version = $3
                  AND model_version = $4
                ORDER BY generated_at DESC
                LIMIT 1
                """,
                device_id,
                report["id"],
                cache_prompt_version,
                cache_model_version,
            )
            if cached:
                now = datetime.now(timezone.utc)
                age_seconds = (now - cached["generated_at"]).total_seconds()
                if age_seconds <= settings.ai_cache_ttl_seconds:
                    reasons_raw = cached["reasons_json"] or []
                    actions_raw = cached["actions_json"] or []
                    if isinstance(reasons_raw, str):
                        try:
                            reasons_raw = json.loads(reasons_raw)
                        except Exception:
                            reasons_raw = []
                    if isinstance(actions_raw, str):
                        try:
                            actions_raw = json.loads(actions_raw)
                        except Exception:
                            actions_raw = []
                    actions = [
                        DeviceAiRecommendedAction(**action)
                        for action in list(actions_raw)
                    ]
                    cached_response = DeviceAiSummaryResponse(
                        enabled=True,
                        source=cached["source"],
                        summary=cached["summary"],
                        risk_level=cached["risk_level"],
                        reasons=list(reasons_raw),
                        recommended_actions=actions,
                        based_on_report_id=cached["report_id"],
                        generated_at=cached["generated_at"],
                    )
                    return apply_audience_view(
                        cached_response,
                        audience=audience,
                        is_online=bool(
                            device["last_seen_at"]
                            and (datetime.now(timezone.utc) - device["last_seen_at"]) < timedelta(minutes=2)
                        ),
                    )

    now = datetime.now(timezone.utc)
    last_seen = device["last_seen_at"]
    is_online = bool(last_seen and (now - last_seen) < timedelta(minutes=2))

    try:
        rule_based = build_device_ai_summary(
            is_online=is_online,
            latest_report=dict(report) if report else None,
        )
        summary = await generate_device_ai_summary(
            is_online=is_online,
            latest_report=dict(report) if report else None,
            rule_based=rule_based,
            rate_limit_key=f"user:{current_user['id']}:device:{device_id}:provider:{provider_name}",
            trace_id=getattr(request.state, "trace_id", "unknown"),
            audience=audience,
            provider=provider_name,
        )
        if report:
            async with get_connection() as conn:
                trend_rows = await conn.fetch(
                    """
                    SELECT created_at, disk_free_percent, startup_apps_count
                    FROM reports
                    WHERE device_id = $1
                      AND created_at > NOW() - INTERVAL '7 days'
                    ORDER BY created_at DESC
                    LIMIT 8
                    """,
                    device_id,
                )
                ping_latencies = await _fetch_ping_latency_samples(conn, device_id)
            trend = _build_trend_signals(
                device_id,
                [dict(row) for row in trend_rows],
                ping_latencies=ping_latencies,
            )
            degraded_notes = [signal.note for signal in trend.signals if signal.status == "degraded"]
            if degraded_notes:
                merged_reasons = (summary.reasons + degraded_notes)[:4]
                summary = summary.model_copy(update={"reasons": merged_reasons})

        async with get_connection() as conn:
            ranked = await _rank_actions_by_history(
                conn=conn,
                device_id=device_id,
                actions=summary.recommended_actions,
            )
            summary = summary.model_copy(update={"recommended_actions": ranked})

        if settings.enable_ai_copilot and report and audience == "operator":
            async with get_connection() as conn:
                await conn.execute(
                    """
                    INSERT INTO ai_insights (
                        id, device_id, user_id, report_id,
                        source, summary, risk_level, reasons_json, actions_json, prompt_version, model_version, generated_at
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10, $11, $12)
                    ON CONFLICT (device_id, report_id)
                    DO UPDATE SET
                        source = EXCLUDED.source,
                        summary = EXCLUDED.summary,
                        risk_level = EXCLUDED.risk_level,
                        reasons_json = EXCLUDED.reasons_json,
                        actions_json = EXCLUDED.actions_json,
                        prompt_version = EXCLUDED.prompt_version,
                        model_version = EXCLUDED.model_version,
                        generated_at = EXCLUDED.generated_at
                    """,
                    generate_id("ais"),
                    device_id,
                    current_user["id"],
                    report["id"],
                    summary.source,
                    summary.summary,
                    summary.risk_level,
                    json.dumps(summary.reasons, ensure_ascii=False),
                    json.dumps([action.model_dump() for action in summary.recommended_actions], ensure_ascii=False),
                    cache_prompt_version,
                    cache_model_version,
                    summary.generated_at,
                )
        return summary
    except Exception:
        logger.exception("AI summary fallback triggered")
        return DeviceAiSummaryResponse(
            enabled=settings.enable_ai_copilot,
            source="fallback",
            summary="AI 요약 생성에 실패했습니다. 기본 점검 액션을 사용하세요.",
            risk_level="unknown",
            reasons=["AI 요약 생성 중 일시적 오류가 발생했습니다."],
            recommended_actions=[],
            based_on_report_id=report["id"] if report else None,
            generated_at=datetime.now(timezone.utc),
        )


@router.get("/{device_id}/ai-trends", response_model=DeviceTrendResponse)
async def get_device_ai_trends(
    device_id: str,
    current_user: dict = Depends(get_current_user),
):
    async with get_connection() as conn:
        device = await conn.fetchrow(
            "SELECT id FROM devices WHERE id = $1 AND user_id = $2",
            device_id,
            current_user["id"],
        )
        if not device:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Device not found",
            )

        rows = await conn.fetch(
            """
            SELECT created_at, disk_free_percent, startup_apps_count
            FROM reports
            WHERE device_id = $1
              AND created_at > NOW() - INTERVAL '7 days'
            ORDER BY created_at DESC
            LIMIT 8
            """,
            device_id,
        )
        ping_latencies = await _fetch_ping_latency_samples(conn, device_id)
    return _build_trend_signals(
        device_id,
        [dict(row) for row in rows],
        ping_latencies=ping_latencies,
    )


@router.post("/{device_id}/revoke")
async def revoke_device(
    device_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Revoke a device and invalidate its tokens."""
    async with get_connection() as conn:
        # Verify ownership
        device = await conn.fetchrow("""
            SELECT id, revoked_at
            FROM devices
            WHERE id = $1 AND user_id = $2
        """, device_id, current_user["id"])
        
        if not device:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Device not found",
            )
        
        if device["revoked_at"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Device already revoked",
            )
        
        # Revoke device and tokens
        now = datetime.now(timezone.utc)
        await conn.execute(
            "UPDATE devices SET revoked_at = $1 WHERE id = $2",
            now, device_id,
        )
        await conn.execute(
            "UPDATE device_tokens SET revoked_at = $1 WHERE device_id = $2",
            now, device_id,
        )
    
    return {"message": "Device revoked successfully"}


@router.delete("/{device_id}")
async def delete_device(
    device_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Permanently delete a device and all its history."""
    async with get_connection() as conn:
        # Verify ownership
        device = await conn.fetchrow("""
            SELECT id
            FROM devices
            WHERE id = $1 AND user_id = $2
        """, device_id, current_user["id"])
        
        if not device:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Device not found",
            )
        
        # Delete related data (cascade manually if not set in DB)
        # 1. Device Tokens
        await conn.execute("DELETE FROM device_tokens WHERE device_id = $1", device_id)
        
        # 2. Reports
        await conn.execute("DELETE FROM reports WHERE device_id = $1", device_id)
        
        # 3. Commands
        await conn.execute("DELETE FROM commands WHERE device_id = $1", device_id)
        
        # 4. The Device
        await conn.execute("DELETE FROM devices WHERE id = $1", device_id)
    
    return {"message": "Device deleted permanently"}
