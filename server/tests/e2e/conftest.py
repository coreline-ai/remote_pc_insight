
import pytest
import os
import time
import subprocess
import httpx
from app.core.config import settings

@pytest.fixture(scope="session")
def e2e_env():
    # Set environment variables for the test server
    os.environ["DATABASE_URL"] = "postgresql://postgres:postgres@localhost:5433/pcinsight_test"
    os.environ["PORT"] = "8001"
    
    # Ensure no other process is running on 8001?
    # Actually, uvicorn will be started by the test fixture.
    
    yield
    
    # Cleanup envs?
    pass

@pytest.fixture(scope="session")
def test_server(e2e_env):
    # Start the server as a subprocess
    # We use 'uvicorn app.main:app --port 8001'
    proc = subprocess.Popen(
        ["uvicorn", "app.main:app", "--port", "8001"],
        env=os.environ.copy(),
        cwd=os.path.join(os.path.dirname(__file__), "../.."), # Root server dir
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )
    

    # Wait for server to be ready
    base_url = "http://localhost:8001"
    max_retries = 20
    import httpx
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
        raise RuntimeError("Server failed to start")
        
    yield base_url
    
    # Teardown
    proc.terminate()
    proc.wait()

