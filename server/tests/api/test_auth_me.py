import pytest

from app.api.v1.deps import get_current_user
from app.main import app


@pytest.mark.anyio
async def test_auth_me_returns_current_user(client):
    app.dependency_overrides[get_current_user] = lambda: {"id": "usr_1", "email": "test@example.com"}
    response = await client.get("/v1/auth/me")
    assert response.status_code == 200
    assert response.json() == {"id": "usr_1", "email": "test@example.com"}
    app.dependency_overrides = {}

