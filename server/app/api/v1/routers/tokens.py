from fastapi import APIRouter, Depends, Request
from datetime import datetime, timedelta, timezone

from app.api.v1.deps import get_current_user
from app.core.database import get_connection
from app.core.security import generate_token, hash_token, generate_id
from app.core.config import settings
from app.models import (
    EnrollTokenCreate,
    EnrollTokenResponse,
    EnrollTokenStatusRequest,
    EnrollTokenStatusResponse,
)
from app.services.request_rate_limit import enforce_request_rate_limit

router = APIRouter()


@router.post("/enroll", response_model=EnrollTokenResponse)
async def create_enroll_token(
    http_request: Request,
    request: EnrollTokenCreate,
    current_user: dict = Depends(get_current_user),
):
    """Generate a new enrollment token for device registration."""
    await enforce_request_rate_limit(request=http_request, scope=f"token:enroll:user:{current_user['id']}")
    token = generate_token("enroll")
    token_hash = hash_token(token)
    token_id = generate_id("et")
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=request.expires_in_minutes)
    
    async with get_connection() as conn:
        await conn.execute("""
            INSERT INTO enroll_tokens (id, user_id, token_hash, expires_at)
            VALUES ($1, $2, $3, $4)
        """, token_id, current_user["id"], token_hash, expires_at)
    
    return EnrollTokenResponse(
        token=token,
        expires_at=expires_at,
    )


@router.post("/enroll/status", response_model=EnrollTokenStatusResponse)
async def get_enroll_token_status(
    http_request: Request,
    request: EnrollTokenStatusRequest,
    current_user: dict = Depends(get_current_user),
):
    await enforce_request_rate_limit(
        request=http_request,
        scope=f"token:enroll:status:user:{current_user['id']}",
    )
    token_hash = hash_token(request.token)
    async with get_connection() as conn:
        row = await conn.fetchrow(
            """
            SELECT expires_at, used_at, used_device_id
            FROM enroll_tokens
            WHERE token_hash = $1
              AND user_id = $2
            """,
            token_hash,
            current_user["id"],
        )
    if not row:
        return EnrollTokenStatusResponse(status="not_found")
    if row["used_at"] is not None:
        return EnrollTokenStatusResponse(
            status="used",
            expires_at=row["expires_at"],
            used_at=row["used_at"],
            used_device_id=row["used_device_id"],
        )
    if row["expires_at"] <= datetime.now(timezone.utc):
        return EnrollTokenStatusResponse(
            status="expired",
            expires_at=row["expires_at"],
        )
    return EnrollTokenStatusResponse(
        status="pending",
        expires_at=row["expires_at"],
    )
