from datetime import datetime, timezone

from app.core.config import settings
from app.services.ai_copilot import build_device_ai_summary


def test_ai_regression_matrix_rule_based(monkeypatch):
    monkeypatch.setattr(settings, "enable_ai_copilot", True)

    now = datetime.now(timezone.utc)
    scenarios = [
        {
            "name": "high-risk",
            "is_online": True,
            "report": {
                "id": "rpt_high",
                "health_score": 45,
                "disk_free_percent": 9.5,
                "startup_apps_count": 48,
                "one_liner": "즉시 조치 필요",
                "created_at": now,
            },
            "expected_risk": "high",
            "expected_action": "RUN_FULL",
        },
        {
            "name": "medium-risk",
            "is_online": True,
            "report": {
                "id": "rpt_medium",
                "health_score": 74,
                "disk_free_percent": 22.0,
                "startup_apps_count": 15,
                "one_liner": "주의 상태",
                "created_at": now,
            },
            "expected_risk": "medium",
            "expected_action": "RUN_STORAGE_ONLY",
        },
        {
            "name": "low-risk",
            "is_online": True,
            "report": {
                "id": "rpt_low",
                "health_score": 93,
                "disk_free_percent": 58.0,
                "startup_apps_count": 6,
                "one_liner": "정상 상태",
                "created_at": now,
            },
            "expected_risk": "low",
            "expected_action": "PING",
        },
        {
            "name": "no-report",
            "is_online": False,
            "report": None,
            "expected_risk": "medium",
            "expected_action": "RUN_FULL",
        },
    ]

    for scenario in scenarios:
        result = build_device_ai_summary(
            is_online=scenario["is_online"],
            latest_report=scenario["report"],
        )
        actions = [action.command_type for action in result.recommended_actions]
        assert result.risk_level == scenario["expected_risk"], scenario["name"]
        assert scenario["expected_action"] in actions, scenario["name"]
