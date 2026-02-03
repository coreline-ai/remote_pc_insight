
import asyncio
import asyncpg

DATABASE_URL = "postgresql://postgres:postgres@localhost:5433/pcinsight_test"

async def reset_token():
    conn = await asyncpg.connect(DATABASE_URL)
    # Reset used_at for 'et_test'
    await conn.execute("UPDATE enroll_tokens SET used_at = NULL WHERE id = 'et_test'")
    # Also delete the device that used it to avoid conflict?
    # The device table has unique constraint on fingerprint/token?
    # Let's clean up devices created by this token to be clean.
    # Actually device creation doesn't enforce unique fingerprint strictly in schema (it's just hash).
    # But let's just reset the token first.
    print("Token reset successfully.")
    await conn.close()

if __name__ == "__main__":
    asyncio.run(reset_token())
