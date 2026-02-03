
import asyncio
import os
import asyncpg
from app.core.security import hash_password

# Database URL for E2E Test (Port 5433)
DATABASE_URL = "postgresql://postgres:postgres@localhost:5433/pcinsight_test"

async def update_password():
    print(f"Connecting to {DATABASE_URL}...")
    try:
        conn = await asyncpg.connect(DATABASE_URL)
        
        # Valid bcrypt hash for "password123"
        # We can use the app's hash_password utility if we can import it, 
        # but to be safe and standalone, we can use a known valid hash or generate one.
        # Let's try to verify if we can import logic, otherwise we use a pre-calculated hash.
        # "password123" -> $2b$12$CQ.vl... (bcrypt)
        
        new_password = "password123"
        hashed = hash_password(new_password)
        
        await conn.execute("""
            UPDATE users 
            SET password_hash = $1 
            WHERE id = 'test-user-id'
        """, hashed)
        
        print(f"Password updated for 'test-user-id' (test@example.com)")
        print(f"New Password: {new_password}")
        
        await conn.close()
        
    except Exception as e:
        print(f"Error updating password: {e}")
        exit(1)

if __name__ == "__main__":
    asyncio.run(update_password())
