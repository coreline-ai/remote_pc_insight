import uuid

import httpx
import pytest


@pytest.mark.e2e
def test_auth_refresh_flow(test_server):
    base_url = test_server
    health = httpx.get(f"{base_url}/health")
    assert health.status_code == 200
    if health.json().get("database") != "ok":
        pytest.skip("E2E skipped: database is unavailable")

    email = f"e2e_refresh_{uuid.uuid4().hex[:8]}@local.test"
    password = "Passw0rd!"
    assert httpx.post(
        f"{base_url}/v1/auth/register",
        json={"email": email, "password": password},
    ).status_code == 200

    with httpx.Client(base_url=base_url, timeout=20) as client:
        login = client.post("/v1/auth/login", json={"email": email, "password": password})
        assert login.status_code == 200
        assert "set-cookie" in {key.lower() for key in login.headers.keys()}

        me = client.get("/v1/auth/me")
        assert me.status_code == 200
        assert me.json()["email"] == email

        refresh = client.post("/v1/auth/refresh")
        assert refresh.status_code == 200
        assert refresh.json().get("access_token")

        logout = client.post("/v1/auth/logout")
        assert logout.status_code == 200

        me_after = client.get("/v1/auth/me")
        assert me_after.status_code == 401

