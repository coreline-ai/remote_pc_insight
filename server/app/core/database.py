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
                used_device_id TEXT,
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

        # AI insights table (cached AI copilot summaries)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS ai_insights (
                id TEXT PRIMARY KEY,
                device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                report_id TEXT REFERENCES reports(id) ON DELETE CASCADE,
                source TEXT NOT NULL,
                summary TEXT NOT NULL,
                risk_level TEXT NOT NULL,
                reasons_json JSONB NOT NULL DEFAULT '[]'::jsonb,
                actions_json JSONB NOT NULL DEFAULT '[]'::jsonb,
                prompt_version TEXT NOT NULL DEFAULT 'v1',
                model_version TEXT NOT NULL DEFAULT 'default',
                generated_at TIMESTAMPTZ NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                UNIQUE(device_id, report_id)
            )
        """)

        # Report share links
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS report_shares (
                id TEXT PRIMARY KEY,
                report_id TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                share_token TEXT UNIQUE,
                share_token_hash TEXT UNIQUE,
                expires_at TIMESTAMPTZ NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                revoked_at TIMESTAMPTZ
            )
        """)

        # Backward-compatible schema upgrades
        await conn.execute("""
            ALTER TABLE ai_insights
            ADD COLUMN IF NOT EXISTS prompt_version TEXT NOT NULL DEFAULT 'v1'
        """)
        await conn.execute("""
            ALTER TABLE ai_insights
            ADD COLUMN IF NOT EXISTS model_version TEXT NOT NULL DEFAULT 'default'
        """)
        await conn.execute("""
            ALTER TABLE enroll_tokens
            ADD COLUMN IF NOT EXISTS used_device_id TEXT
        """)
        await conn.execute("""
            ALTER TABLE report_shares
            ADD COLUMN IF NOT EXISTS share_token_hash TEXT
        """)
        await conn.execute("""
            ALTER TABLE report_shares
            ALTER COLUMN share_token DROP NOT NULL
        """)

        # Refresh token table (web session rotation)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS auth_refresh_tokens (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                token_hash TEXT UNIQUE NOT NULL,
                expires_at TIMESTAMPTZ NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                revoked_at TIMESTAMPTZ
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

        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_ai_insights_device_generated
            ON ai_insights(device_id, generated_at DESC)
        """)

        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_report_shares_token_expires
            ON report_shares(share_token, expires_at DESC)
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_report_shares_token_hash_expires
            ON report_shares(share_token_hash, expires_at DESC)
        """)

        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_auth_refresh_user_created
            ON auth_refresh_tokens(user_id, created_at DESC)
        """)
