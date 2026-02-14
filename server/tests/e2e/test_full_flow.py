
import pytest
import httpx
import subprocess
import os
import json
import uuid

@pytest.mark.e2e
def test_full_flow(test_server):
    """
    E2E Test Scenario:
    1. Check Server Health
    2. Agent: Enroll Device using Pre-seeded Token
    3. Server: Verify Device Created
    """
    base_url = test_server
    print(f"\n[E2E] Server running at {base_url}")
    
    # 1. Health Check
    resp = httpx.get(f"{base_url}/health")
    assert resp.status_code == 200
    health_data = resp.json()
    if health_data.get("database") != "ok":
        pytest.skip("E2E skipped: database is unavailable")
    
    # 2. Prepare user + enrollment token
    email = f"e2e_{uuid.uuid4().hex[:8]}@local.test"
    password = "Passw0rd!"
    register_resp = httpx.post(
        f"{base_url}/v1/auth/register",
        json={"email": email, "password": password},
    )
    assert register_resp.status_code == 200

    login_resp = httpx.post(
        f"{base_url}/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert login_resp.status_code == 200
    access_token = login_resp.json()["access_token"]

    enroll_resp = httpx.post(
        f"{base_url}/v1/tokens/enroll",
        json={"expires_in_minutes": 60},
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert enroll_resp.status_code == 200
    enroll_token = enroll_resp.json()["token"]
    
    # Run Agent CLI 'link' command
    # We use 'npm run dev -- link ...' or 'npx tsx src/index.ts link ...'
    agent_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../agent"))
    
    # Use a temp HOME to avoid overwriting real config
    import tempfile
    with tempfile.TemporaryDirectory() as tmp_home:
        env = os.environ.copy()
        env["HOME"] = tmp_home
        
        print(f"Running Agent in {agent_dir} with HOME={tmp_home}")
        
        cmd = [
            "npm", "run", "dev", "--", "link",
            enroll_token,
            "--server", base_url
        ]
        
        result = subprocess.run(
            cmd,
            cwd=agent_dir,
            env=env,
            capture_output=True,
            text=True
        )
        
        print("Agent Output:\n", result.stdout)
        print("Agent Error:\n", result.stderr)
        
        assert result.returncode == 0, "Agent link command failed"
        assert "Device linked successfully" in result.stdout
        
        # 3. Verify Local Config Created
        config_path = os.path.join(tmp_home, ".pc-insight", "config.json")
        assert os.path.exists(config_path)
        with open(config_path) as f:
            config = json.load(f)
            assert config["serverUrl"] == base_url
            assert config["deviceId"] is not None
            
        # 4. Verify Server DB
        devices_resp = httpx.get(
            f"{base_url}/v1/devices",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        assert devices_resp.status_code == 200
        assert devices_resp.json()["total"] >= 1
        
        print("\n[SUCCESS] Full Flow Verified: Server Health -> Agent Link -> Config Saved")
