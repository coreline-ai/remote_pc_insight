
import pytest
from httpx import AsyncClient

@pytest.mark.anyio
async def test_root(client: AsyncClient):
    response = await client.get("/")
    assert response.status_code == 200
    assert response.json() == {
        "name": "pc-insight Cloud API",
        "version": "0.1.0",
        "status": "healthy",
    }

@pytest.mark.anyio
async def test_health(client: AsyncClient):
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in {"ok", "degraded"}
    assert data["database"] in {"ok", "unavailable"}
