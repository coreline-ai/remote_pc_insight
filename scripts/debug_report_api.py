
import asyncio
import os
import sys
import httpx

# Add server directory to path
sys.path.append(os.path.join(os.getcwd(), "server"))

from app.core.database import get_connection
from app.core.security import create_jwt_token

async def debug_report():
    # 1. Get User ID
    user_id = "test-user-id"
    
    # 2. Generate Token
    token = create_jwt_token({"sub": user_id})
    print(f"Generated Token: {token[:10]}...")
    
    # 3. Find a Report ID from DB
    report_id = None
    try:
        # We need to set DATABASE_URL env var for get_connection if it relies on config
        # Assuming defaults or already set. The e2e setups use port 5433.
        # But app.core.config uses .env or defaults.
        # Let's inspect app.core.config first via import.
        from app.core.config import settings
        print(f"Database URL from settings: {settings.database_url}")
        
        # Override if necessary for test env (port 5433)
        # settings.POSTGRES_PORT is likely 5432 by default.
        # If running e2e, we might need 5433.
        pass
    except Exception as e:
        print(f"Config Error: {e}")

    # For this script, let's just use asyncpg directly with the known E2E URL
    DATABASE_URL = "postgresql://postgres:postgres@localhost:5433/pcinsight_test"
    import asyncpg
    
    conn = await asyncpg.connect(DATABASE_URL)
    row = await conn.fetchrow("SELECT id FROM reports ORDER BY created_at DESC LIMIT 1")
    if row:
        report_id = row["id"]
        print(f"Found Report ID: {report_id}")
    else:
        print("No reports found in DB.")
        return

    await conn.close()
    
    # 4. Fetch Report via API
    url = f"http://localhost:8001/v1/reports/{report_id}"
    print(f"Requesting: {url}")
    
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, headers={"Authorization": f"Bearer {token}"})
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            import json
            data = resp.json()
            print("=== RAW REPORT JSON START ===")
            print(json.dumps(data, indent=2))
            print("=== RAW REPORT JSON END ===")
        else:
            print("Error Response:", resp.text)

if __name__ == "__main__":
    asyncio.run(debug_report())
