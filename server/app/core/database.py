import asyncpg
from contextlib import asynccontextmanager
from typing import AsyncGenerator, Optional
from app.core.config import settings

# Connection pool (singleton)
_pool: Optional[asyncpg.Pool] = None


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            settings.database_url,
            min_size=5,
            max_size=20,
            command_timeout=60,
        )
    return _pool


async def close_pool():
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


@asynccontextmanager
async def get_connection() -> AsyncGenerator[asyncpg.Connection, None]:
    pool = await get_pool()
    async with pool.acquire() as connection:
        yield connection


async def init_db():
    """Initialize database with required tables."""
    async with get_connection() as conn:
        # Users table
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)
        
        # Enroll tokens table
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS enroll_tokens (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                token_hash TEXT UNIQUE NOT NULL,
                expires_at TIMESTAMPTZ NOT NULL,
                used_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)
        
        # Devices table
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS devices (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                platform TEXT NOT NULL,
                arch TEXT NOT NULL,
                fingerprint_hash TEXT,
                agent_version TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                last_seen_at TIMESTAMPTZ,
                revoked_at TIMESTAMPTZ
            )
        """)
        
        # Device tokens table
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS device_tokens (
                id TEXT PRIMARY KEY,
                device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
                token_hash TEXT UNIQUE NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                expires_at TIMESTAMPTZ,
                revoked_at TIMESTAMPTZ,
                last_used_at TIMESTAMPTZ
            )
        """)
        
        # Commands table
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS commands (
                id TEXT PRIMARY KEY,
                device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                type TEXT NOT NULL,
                params_json JSONB NOT NULL DEFAULT '{}'::jsonb,
                status TEXT NOT NULL DEFAULT 'queued',
                progress INT NOT NULL DEFAULT 0,
                message TEXT NOT NULL DEFAULT '',
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                started_at TIMESTAMPTZ,
                finished_at TIMESTAMPTZ,
                expires_at TIMESTAMPTZ,
                report_id TEXT,
                dedupe_key TEXT
            )
        """)
        
        # Reports table
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS reports (
                id TEXT PRIMARY KEY,
                device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
                command_id TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                health_score INT,
                disk_free_percent REAL,
                startup_apps_count INT,
                one_liner TEXT,
                raw_report_json JSONB
            )
        """)
        
        # Device settings table
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS device_settings (
                device_id TEXT PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
                upload_level INT NOT NULL DEFAULT 0,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)
        
        # Indexes for performance
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_commands_device_status_created
            ON commands(device_id, status, created_at ASC)
        """)
        
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_reports_device_created
            ON reports(device_id, created_at DESC)
        """)
        
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_devices_user_lastseen
            ON devices(user_id, last_seen_at DESC)
        """)
