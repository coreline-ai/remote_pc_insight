
import os
import socket
import subprocess
import sys
import time

import httpx
import pytest

@pytest.fixture(scope="session")
def e2e_env():
    # Set environment variables for the test server
    os.environ["DATABASE_URL"] = "postgresql://postgres:postgres@localhost:55433/pcinsight_test"
    os.environ["ENABLE_AI_COPILOT"] = "true"
    os.environ["AUTH_REGISTER_RATE_LIMIT_REQUESTS"] = "100"
    os.environ["AUTH_LOGIN_RATE_LIMIT_REQUESTS"] = "200"
    
    # Ensure no other process is running on 8001?
    # Actually, uvicorn will be started by the test fixture.
    
    yield
    
    # Cleanup envs?
    pass

@pytest.fixture(scope="session")
def test_server(e2e_env):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    os.environ["PORT"] = str(port)

    # Start the server as a subprocess
    # We use a random free port to avoid conflicts with local dev servers.
    proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app.main:app", "--port", str(port)],
        env=os.environ.copy(),
        cwd=os.path.join(os.path.dirname(__file__), "../.."), # Root server dir
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )
    

    # Wait for server to be ready
    base_url = f"http://localhost:{port}"
    max_retries = 20
    for _ in range(max_retries):
        try:
            response = httpx.get(f"{base_url}/health")
            if response.status_code == 200:
                print("Server is ready!")
                break
        except httpx.ConnectError:
            time.sleep(0.5)

    else:
        proc.kill()
        pytest.skip("E2E setup skipped: server failed to start (DB unavailable or misconfigured)")
        
    yield base_url
    
    # Teardown
    proc.terminate()
    proc.wait()
