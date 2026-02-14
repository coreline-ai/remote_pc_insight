import logging

from app.core.config import settings
from app.core.database import get_connection
from app.core.security import generate_id, hash_password

logger = logging.getLogger(__name__)


async def ensure_mvp_test_login_user() -> None:
    env = settings.environment.lower()
    if env not in {"development", "test"}:
        return
    if not settings.mvp_test_login_enabled:
        return

    email = settings.mvp_test_login_email.strip().lower()
    password = settings.mvp_test_login_password
    if not email or not password:
        logger.warning("MVP test login seed skipped: email/password is empty")
        return

    password_hash = hash_password(password)
    async with get_connection() as conn:
        row = await conn.fetchrow(
            "SELECT id FROM users WHERE lower(email) = $1",
            email,
        )
        if row:
            await conn.execute(
                "UPDATE users SET password_hash = $1 WHERE id = $2",
                password_hash,
                row["id"],
            )
            logger.info("MVP test login user password refreshed: %s", email)
            return

        await conn.execute(
            """
            INSERT INTO users (id, email, password_hash, created_at)
            VALUES ($1, $2, $3, NOW())
            """,
            generate_id("usr"),
            email,
            password_hash,
        )
        logger.info("MVP test login user created: %s", email)
