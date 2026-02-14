import base64
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest

from app.api.v1.deps import get_current_user
from app.main import app


class MockConnection:
    def __init__(self):
        self.fetchrow = AsyncMock()


@pytest.mark.anyio
async def test_report_export_pdf_returns_base64_pdf(client):
    mock_conn = MockConnection()
    mock_conn.fetchrow.return_value = {
        "id": "rpt_1",
        "created_at": datetime.now(timezone.utc),
        "health_score": 77,
        "disk_free_percent": 31.5,
        "startup_apps_count": 12,
        "one_liner": "PDF export test",
        "device_name": "QA Device",
    }

    @asynccontextmanager
    async def mock_get_connection():
        yield mock_conn

    app.dependency_overrides[get_current_user] = lambda: {"id": "usr_1", "email": "test@example.com"}

    with patch("app.api.v1.routers.reports.get_connection", side_effect=mock_get_connection):
        response = await client.get("/v1/reports/rpt_1/export?format=pdf")

    assert response.status_code == 200
    body = response.json()
    assert body["format"] == "pdf"
    assert body["encoding"] == "base64"
    assert body["filename"].endswith(".pdf")
    decoded = base64.b64decode(body["content"])
    assert decoded.startswith(b"%PDF-1.4")
    app.dependency_overrides = {}
