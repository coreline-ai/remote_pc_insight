from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.core.config import settings
from app.models import DeviceAiRecommendedAction, DeviceAiSummaryResponse


def build_device_ai_summary(
    *,
    is_online: bool,
    latest_report: Optional[Dict[str, Any]],
) -> DeviceAiSummaryResponse:
    if not settings.enable_ai_copilot:
        return DeviceAiSummaryResponse(
            enabled=False,
            source="disabled",
            summary="AI 운영 코파일럿이 비활성화되어 있습니다.",
            risk_level="unknown",
            reasons=["ENABLE_AI_COPILOT=false"],
            recommended_actions=[],
            based_on_report_id=latest_report["id"] if latest_report else None,
            generated_at=datetime.now(timezone.utc),
        )

    report_id = latest_report["id"] if latest_report else None
    reasons: List[str] = []
    actions: List[DeviceAiRecommendedAction] = []

    if not latest_report:
        reasons.append("아직 분석 리포트가 없어 기초 점검이 필요합니다.")
        actions.append(
            DeviceAiRecommendedAction(
                command_type="PING",
                label="연결 확인(PING)",
                reason="에이전트 연결 상태를 먼저 확인합니다.",
            )
        )
        actions.append(
            DeviceAiRecommendedAction(
                command_type="RUN_FULL",
                label="전체 점검 실행",
                reason="첫 리포트를 생성해 상태를 파악합니다.",
            )
        )
        return DeviceAiSummaryResponse(
            enabled=True,
            source="rule_based",
            summary="리포트가 없어 초기 점검이 필요합니다.",
            risk_level="medium",
            reasons=reasons,
            recommended_actions=actions,
            based_on_report_id=None,
            generated_at=datetime.now(timezone.utc),
        )

    health_score = latest_report.get("health_score")
    disk_free_percent = latest_report.get("disk_free_percent")
    startup_apps_count = latest_report.get("startup_apps_count")
    one_liner = latest_report.get("one_liner")

    severity_points = 0
    if health_score is not None:
        if health_score < 60:
            severity_points += 2
            reasons.append(f"건강 점수가 낮습니다 ({health_score}).")
        elif health_score < 80:
            severity_points += 1
            reasons.append(f"건강 점수 주의 구간입니다 ({health_score}).")

    if disk_free_percent is not None:
        if disk_free_percent < 15:
            severity_points += 2
            reasons.append(f"디스크 여유 공간이 위험 수준입니다 ({disk_free_percent:.1f}%).")
        elif disk_free_percent < 25:
            severity_points += 1
            reasons.append(f"디스크 여유 공간이 낮습니다 ({disk_free_percent:.1f}%).")

    if startup_apps_count is not None and startup_apps_count >= 40:
        severity_points += 1
        reasons.append(f"시작 프로그램이 많습니다 ({startup_apps_count}개).")

    if not is_online:
        reasons.append("디바이스가 오프라인 상태입니다.")
        actions.append(
            DeviceAiRecommendedAction(
                command_type="PING",
                label="연결 확인(PING)",
                reason="오프라인 상태 여부를 먼저 점검합니다.",
            )
        )

    if severity_points >= 3:
        risk_level = "high"
        actions.append(
            DeviceAiRecommendedAction(
                command_type="RUN_FULL",
                label="전체 점검",
                reason="복합 이슈 가능성이 높아 전체 점검이 필요합니다.",
            )
        )
        actions.append(
            DeviceAiRecommendedAction(
                command_type="RUN_STORAGE_ONLY",
                label="스토리지 점검",
                reason="디스크 관련 악화 요인을 우선 확인합니다.",
            )
        )
    elif severity_points >= 1:
        risk_level = "medium"
        actions.append(
            DeviceAiRecommendedAction(
                command_type="RUN_STORAGE_ONLY",
                label="스토리지 점검",
                reason="중간 수준 경고 지표를 우선 확인합니다.",
            )
        )
        actions.append(
            DeviceAiRecommendedAction(
                command_type="RUN_FULL",
                label="전체 점검",
                reason="필요 시 추가 진단을 진행합니다.",
            )
        )
    else:
        risk_level = "low"
        actions.append(
            DeviceAiRecommendedAction(
                command_type="PING",
                label="연결 확인(PING)",
                reason="현재 상태가 안정적이므로 연결 상태만 확인합니다.",
            )
        )

    summary = one_liner or "최근 지표를 기반으로 리스크 수준을 계산했습니다."

    return DeviceAiSummaryResponse(
        enabled=True,
        source="rule_based",
        summary=summary,
        risk_level=risk_level,
        reasons=reasons[:4],
        recommended_actions=actions[:3],
        based_on_report_id=report_id,
        generated_at=datetime.now(timezone.utc),
    )
