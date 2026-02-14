from datetime import datetime, timezone
from fastapi import Depends, HTTPException, Request, status
from typing import Optional
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from urllib.parse import urlparse

from app.core.config import settings
from app.core.database import get_connection
from app.core.security import decode_jwt_token, hash_token

http_bearer = HTTPBearer(auto_error=False)


def _origin_from_url(value: Optional[str]) -> str:
    if not value:
        return ""
    parsed = urlparse(value)
    if not parsed.scheme or not parsed.netloc:
        return ""
    return f"{parsed.scheme}://{parsed.netloc}".lower()


def _is_state_changing_request(request: Request) -> bool:
    return request.method.upper() in {"POST", "PUT", "PATCH", "DELETE"}


def enforce_csrf_for_cookie_request(request: Request) -> None:
    if not settings.enforce_csrf_for_cookie_auth:
        return
    if not _is_state_changing_request(request):
        return

    origin = _origin_from_url(request.headers.get("origin"))
    if not origin:
        origin = _origin_from_url(request.headers.get("referer"))
    allowed_origins = {origin_value.lower() for origin_value in settings.cors_origins}
    if not origin:
        # Non-browser clients in local/test environments often omit Origin/Referer.
        if settings.environment.lower() in {"development", "test"}:
            return
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="CSRF origin validation failed",
        )
    if origin not in allowed_origins:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="CSRF origin validation failed",
        )

    csrf_value = request.headers.get(settings.csrf_header_name, "").strip()
    if csrf_value != "1":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="CSRF token missing",
        )


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(http_bearer),
) -> dict:
    """Get current authenticated user from JWT token."""
    raw_token: Optional[str] = None
    if credentials and credentials.credentials:
        raw_token = credentials.credentials
    else:
        enforce_csrf_for_cookie_request(request)
        raw_token = request.cookies.get(settings.auth_cookie_name)

    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    payload = decode_jwt_token(raw_token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )
    
    # Verify user exists
    async with get_connection() as conn:
        user = await conn.fetchrow(
            "SELECT id, email FROM users WHERE id = $1",
            user_id,
        )
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
            )
    
    return {"id": user["id"], "email": user["email"]}


async def get_current_user_optional(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(http_bearer),
) -> Optional[dict]:
    """Get current user if authenticated, None otherwise."""
    if credentials is None and not request.cookies.get(settings.auth_cookie_name):
        return None
    
    try:
        return await get_current_user(request, credentials)
    except HTTPException:
        return None


async def verify_device_token(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(http_bearer),
) -> dict:
    """Verify device token and return device info."""
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Device token required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token_hash = hash_token(credentials.credentials)
    
    async with get_connection() as conn:
        result = await conn.fetchrow("""
            SELECT dt.id, dt.device_id, d.user_id, d.name, d.revoked_at
            FROM device_tokens dt
            JOIN devices d ON dt.device_id = d.id
            WHERE dt.token_hash = $1
              AND dt.revoked_at IS NULL
              AND (dt.expires_at IS NULL OR dt.expires_at > NOW())
        """, token_hash)
        
        if not result:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or revoked device token",
            )
        
        if result["revoked_at"]:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Device has been revoked",
            )
        
        # Update last_used_at
        await conn.execute(
            "UPDATE device_tokens SET last_used_at = NOW() WHERE id = $1",
            result["id"],
        )
        
        # Update device last_seen_at
        await conn.execute(
            "UPDATE devices SET last_seen_at = NOW() WHERE id = $1",
            result["device_id"],
        )
    
    return {
        "device_id": result["device_id"],
        "user_id": result["user_id"],
        "device_name": result["name"],
    }


async def verify_enroll_token(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(http_bearer),
) -> dict:
    """Verify enrollment token and return token info."""
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Enrollment token required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token_hash = hash_token(credentials.credentials)
    
    async with get_connection() as conn:
        result = await conn.fetchrow("""
            SELECT id, user_id, expires_at, used_at
            FROM enroll_tokens
            WHERE token_hash = $1
        """, token_hash)
        
        if not result:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid enrollment token",
            )
        
        if result["used_at"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Enrollment token already used",
            )
        
        if result["expires_at"] < datetime.now(timezone.utc):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Enrollment token expired",
            )
    
    return {
        "token_id": result["id"],
        "user_id": result["user_id"],
    }
