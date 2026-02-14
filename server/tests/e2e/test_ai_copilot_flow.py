import uuid

import httpx
import pytest


@pytest.mark.e2e
def test_ai_copilot_summary_and_action_flow(test_server):
    base_url = test_server

    health = httpx.get(f"{base_url}/health")
    assert health.status_code == 200
    if health.json().get("database") != "ok":
        pytest.skip("E2E skipped: database is unavailable")

    email = f"e2e_ai_{uuid.uuid4().hex[:8]}@local.test"
    password = "Passw0rd!"
    assert httpx.post(
        f"{base_url}/v1/auth/register",
        json={"email": email, "password": password},
    ).status_code == 200

    login = httpx.post(
        f"{base_url}/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert login.status_code == 200
    token = login.json()["access_token"]
    auth_headers = {"Authorization": f"Bearer {token}"}

    enroll = httpx.post(
        f"{base_url}/v1/tokens/enroll",
        json={"expires_in_minutes": 60},
        headers=auth_headers,
    )
    assert enroll.status_code == 200
    enroll_token = enroll.json()["token"]

    agent_enroll = httpx.post(
        f"{base_url}/v1/agent/enroll",
        headers={"Authorization": f"Bearer {enroll_token}"},
        json={
            "device_name": "AI E2E Device",
            "platform": "darwin",
            "arch": "arm64",
            "agent_version": "0.1.0",
            "device_fingerprint": f"fp-{uuid.uuid4().hex[:8]}",
        },
    )
    assert agent_enroll.status_code == 200
    device_id = agent_enroll.json()["device_id"]

    ai_summary = httpx.get(
        f"{base_url}/v1/devices/{device_id}/ai-summary",
        headers=auth_headers,
    )
    assert ai_summary.status_code == 200
    summary_body = ai_summary.json()
    assert summary_body["enabled"] is True
    assert summary_body["summary"]
    assert isinstance(summary_body["recommended_actions"], list)

    command_type = (
        summary_body["recommended_actions"][0]["command_type"]
        if summary_body["recommended_actions"]
        else "PING"
    )
    command_resp = httpx.post(
        f"{base_url}/v1/devices/{device_id}/commands",
        headers=auth_headers,
        json={"type": command_type, "params": {}},
    )
    assert command_resp.status_code == 200
    assert command_resp.json()["status"] == "queued"
