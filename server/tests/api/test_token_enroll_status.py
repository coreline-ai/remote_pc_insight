from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

import pytest

from app.api.v1.deps import get_current_user
from app.main import app


class MockConnection:
    def __init__(self):
        self.fetchrow = AsyncMock()


@pytest.fixture
def mock_db():
    conn = MockConnection()

    @asynccontextmanager
    async def mock_get_connection():
        yield conn

    with patch('app.api.v1.routers.tokens.get_connection', side_effect=mock_get_connection):
        yield conn


@pytest.mark.anyio
async def test_enroll_token_status_pending_and_used(client, mock_db):
    app.dependency_overrides[get_current_user] = lambda: {'id': 'usr_1', 'email': 'u@test.local'}

    now = datetime.now(timezone.utc)
    mock_db.fetchrow.side_effect = [
        {'expires_at': now + timedelta(minutes=10), 'used_at': None, 'used_device_id': None},
        {'expires_at': now + timedelta(minutes=10), 'used_at': now, 'used_device_id': 'dev_1234'},
    ]

    pending = await client.post('/v1/tokens/enroll/status', json={'token': 'enroll_token_abc123'})
    used = await client.post('/v1/tokens/enroll/status', json={'token': 'enroll_token_abc123'})

    assert pending.status_code == 200
    assert pending.json()['status'] == 'pending'
    assert used.status_code == 200
    assert used.json()['status'] == 'used'
    assert used.json()['used_device_id'] == 'dev_1234'


@pytest.mark.anyio
async def test_enroll_token_status_not_found(client, mock_db):
    app.dependency_overrides[get_current_user] = lambda: {'id': 'usr_1', 'email': 'u@test.local'}
    mock_db.fetchrow.return_value = None

    response = await client.post('/v1/tokens/enroll/status', json={'token': 'enroll_token_abc123'})

    assert response.status_code == 200
    assert response.json()['status'] == 'not_found'
