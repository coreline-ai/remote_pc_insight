
import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from app.main import app
from app.core.security import generate_token, hash_token, generate_id
from contextlib import asynccontextmanager

# Mock DB Connection
class MockConnection:
    def __init__(self):
        self.execute = AsyncMock()
        self.fetchrow = AsyncMock()
        self.fetch = AsyncMock()

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        pass

@pytest.fixture
def mock_db():
    mock_conn = MockConnection()
    
    # Mock the async context manager get_connection
    @asynccontextmanager
    async def mock_get_connection():
        yield mock_conn

    # Patch where it is imported/used. 
    # Since agent.py imports it from app.core.database, we patch app.core.database.get_connection
    # OR if agent.py does "from app.core.database import get_connection", we might need to patch 'app.api.v1.routers.agent.get_connection'
    # Let's check agent.py again. It does: "from app.core.database import get_connection"
    with patch("app.api.v1.routers.agent.get_connection", side_effect=mock_get_connection):
        yield mock_conn

@pytest.mark.anyio
async def test_agent_enroll_success(client, mock_db):
    # Prepare dependencies
    enroll_token = "test-enroll-token"
    token_hash = hash_token(enroll_token)
    
    # Mock verify_enroll_token dependency implicitly by mocking DB or logic?
    # Ideally we should mock the DB call that verify_enroll_token might make, 
    # BUT verify_enroll_token is a dependency. 
    # Let's override verify_enroll_token too for cleaner unit/integration testing of the ROUTER logic specifically.
    # However, to test "Integration", ideally we test the whole chain. 
    # But verify_enroll_token needs DB access to check the token.
    
    # Let's mock the DB response for verify_enroll_token if possible, OR override the dependency.
    # Overriding dependency is safer for "Server Logic" testing without complex DB state setup.
    
    from app.api.v1.routers.agent import verify_enroll_token
    app.dependency_overrides[verify_enroll_token] = lambda: {"token_id": "t1", "user_id": "u1"}

    payload = {
        "device_name": "Test Device",
        "platform": "darwin",
        "arch": "arm64",
        "agent_version": "0.1.0",
        "device_fingerprint": "fingerprint123"
    }

    response = await client.post("/v1/agent/enroll", json=payload, headers={"Authorization": f"Bearer {enroll_token}"})

    assert response.status_code == 200
    data = response.json()
    assert "device_id" in data
    assert "device_token" in data
    assert "expires_in" in data
    
    # Verify DB interactions
    assert mock_db.execute.call_count >= 4 # insert device, token, settings, update enroll token
