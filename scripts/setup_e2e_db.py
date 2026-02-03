
import asyncio
import asyncpg
import os

# Database URL for E2E Test (Port 5433)
DATABASE_URL = "postgresql://postgres:postgres@localhost:5433/pcinsight_test"

async def init_db():
    print(f"Connecting to {DATABASE_URL}...")
    try:
        conn = await asyncpg.connect(DATABASE_URL)
        print("Connected! Initializing Schema...")
        
        # We need to replicate the schema creation logic from app.core.database.init_db
        # Or ideally import it. But importing might be tricky if env vars are not set.
        # Let's import it but mock get_connection/get_pool or set env var.
        
        os.environ["DATABASE_URL"] = DATABASE_URL
        from app.core.database import init_db as app_init_db
        from app.core.database import close_pool
        
        await app_init_db()
        await close_pool()
        
        # Seed Data
        print("Seeding test data...")
        from app.core.security import hash_token, generate_id
        from datetime import datetime, timedelta, timezone

        user_id = "test-user-id"
        token_plain = "test-enroll-token"
        token_hash = hash_token(token_plain)
        token_id = "et_test"
        expires_at = datetime.now(timezone.utc) + timedelta(days=365)

        await conn.execute("""
            INSERT INTO users (id, email, password_hash, created_at)
            VALUES ($1, 'test@example.com', 'hashed_pwd', NOW())
            ON CONFLICT DO NOTHING
        """, user_id)

        await conn.execute("""
            INSERT INTO enroll_tokens (id, user_id, token_hash, expires_at)
            VALUES ($1, $2, $3, $4)
        """, token_id, user_id, token_hash, expires_at)
        
        print(f"Seeded User: {user_id}")
        print(f"Seeded Token: {token_plain}")

        print("Schema initialized successfully!")
        await conn.close()
        
    except Exception as e:
        print(f"Error initializing DB: {e}")
        exit(1)

if __name__ == "__main__":
    asyncio.run(init_db())
