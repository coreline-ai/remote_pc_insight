from fastapi import APIRouter, Depends, HTTPException, status
from datetime import datetime, timedelta, timezone

from app.api.v1.deps import get_current_user
from app.core.database import get_connection
from app.core.security import generate_token, hash_token, generate_id
from app.core.config import settings
from app.models import EnrollTokenCreate, EnrollTokenResponse

router = APIRouter()


@router.post("/enroll", response_model=EnrollTokenResponse)
async def create_enroll_token(
    request: EnrollTokenCreate,
    current_user: dict = Depends(get_current_user),
):
    """Generate a new enrollment token for device registration."""
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
