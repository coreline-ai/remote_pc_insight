from app.services import ai_guardrails


def test_ai_metrics_are_scoped_per_user():
    ai_guardrails.record_ai_call(success=True, scope_key="user:one")
    ai_guardrails.record_ai_call(success=False, fallback_used=True, scope_key="user:two")

    user_one = ai_guardrails.get_ai_metrics_snapshot(scope_key="user:one")
    user_two = ai_guardrails.get_ai_metrics_snapshot(scope_key="user:two")

    assert user_one["requests_total"] == 1
    assert user_one["requests_success"] == 1
    assert user_one["requests_failed"] == 0

    assert user_two["requests_total"] == 1
    assert user_two["requests_success"] == 0
    assert user_two["requests_failed"] == 1
    assert user_two["fallback_total"] == 1

