
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from app.api.v1.deps import enforce_csrf_for_cookie_request, get_current_user
from app.core.database import get_connection
from app.core.security import (
    create_jwt_token,
    generate_id,
    generate_token,
    hash_password,
    hash_token,
    verify_password,
)
from app.core.config import settings
from app.services.request_rate_limit import enforce_request_rate_limit
from app.models import CurrentUserResponse, LoginRequest, LoginResponse, UserCreate, UserResponse

router = APIRouter()


def _set_access_cookie(response: Response, access_token: str) -> None:
    cookie_domain = settings.auth_cookie_domain or None
    max_age = settings.jwt_expires_minutes * 60
    response.set_cookie(
        key=settings.auth_cookie_name,
        value=access_token,
        max_age=max_age,
        path=settings.auth_cookie_path,
        domain=cookie_domain,
        secure=settings.auth_cookie_secure,
        httponly=True,
        samesite=settings.auth_cookie_samesite,
    )


def _set_refresh_cookie(response: Response, refresh_token: str) -> None:
    cookie_domain = settings.auth_cookie_domain or None
    max_age = settings.refresh_token_expires_days * 24 * 60 * 60
    response.set_cookie(
        key=settings.refresh_cookie_name,
        value=refresh_token,
        max_age=max_age,
        path=settings.auth_cookie_path,
        domain=cookie_domain,
        secure=settings.auth_cookie_secure,
        httponly=True,
        samesite=settings.auth_cookie_samesite,
    )


async def _issue_refresh_token(conn, user_id: str, now: datetime) -> str:
    raw_refresh = generate_token("rfr")
    await conn.execute(
        """
        INSERT INTO auth_refresh_tokens (id, user_id, token_hash, expires_at, created_at)
        VALUES ($1, $2, $3, $4, $5)
        """,
        generate_id("rtk"),
        user_id,
        hash_token(raw_refresh),
        now + timedelta(days=settings.refresh_token_expires_days),
        now,
    )
    return raw_refresh


@router.get("/me", response_model=CurrentUserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return CurrentUserResponse(id=current_user["id"], email=current_user["email"])

@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest, http_request: Request, response: Response):
    await enforce_request_rate_limit(
        request=http_request,
        scope="auth:login",
        limit=settings.auth_login_rate_limit_requests,
        window_seconds=settings.auth_login_rate_limit_window_seconds,
    )
    normalized_email = request.email.strip().lower()
    now = datetime.now(timezone.utc)
    async with get_connection() as conn:
        user = await conn.fetchrow(
            "SELECT id, email, password_hash FROM users WHERE lower(email) = $1",
            normalized_email,
        )

        if not user or not verify_password(request.password, user["password_hash"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )

        access_token = create_jwt_token(data={"sub": user["id"]})
        refresh_token = await _issue_refresh_token(conn, user["id"], now)

    _set_access_cookie(response, access_token)
    _set_refresh_cookie(response, refresh_token)
    return LoginResponse(
        access_token=access_token,
        expires_in=settings.jwt_expires_minutes * 60,
    )

@router.post("/register", response_model=UserResponse)
async def register(request: UserCreate, http_request: Request):
    await enforce_request_rate_limit(
        request=http_request,
        scope="auth:register",
        limit=settings.auth_register_rate_limit_requests,
        window_seconds=settings.auth_register_rate_limit_window_seconds,
    )
    normalized_email = request.email.strip().lower()
    async with get_connection() as conn:
        # Check if user exists
        exists = await conn.fetchval(
            "SELECT 1 FROM users WHERE lower(email) = $1",
            normalized_email,
        )
        if exists:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered",
            )
            
        user_id = generate_id("usr")
        hashed_pwd = hash_password(request.password)
        
        await conn.execute("""
            INSERT INTO users (id, email, password_hash, created_at)
            VALUES ($1, $2, $3, NOW())
        """, user_id, normalized_email, hashed_pwd)
        
        created_user = await conn.fetchrow(
            "SELECT id, email, created_at FROM users WHERE id = $1",
            user_id
        )
        
        return UserResponse(
            id=created_user["id"],
            email=created_user["email"],
            created_at=created_user["created_at"]
        )


@router.post("/refresh", response_model=LoginResponse)
async def refresh_session(http_request: Request, response: Response):
    await enforce_request_rate_limit(
        request=http_request,
        scope="auth:refresh",
        limit=settings.auth_login_rate_limit_requests,
        window_seconds=settings.auth_login_rate_limit_window_seconds,
    )

    enforce_csrf_for_cookie_request(http_request)
    refresh_token = http_request.cookies.get(settings.refresh_cookie_name)
    if not refresh_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token missing")

    now = datetime.now(timezone.utc)
    refresh_hash = hash_token(refresh_token)

    async with get_connection() as conn:
        async with conn.transaction():
            row = await conn.fetchrow(
                """
                SELECT id, user_id, expires_at, revoked_at
                FROM auth_refresh_tokens
                WHERE token_hash = $1
                FOR UPDATE
                """,
                refresh_hash,
            )
            if not row or row["revoked_at"] is not None or row["expires_at"] <= now:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

            updated = await conn.execute(
                """
                UPDATE auth_refresh_tokens
                SET revoked_at = $1
                WHERE id = $2 AND revoked_at IS NULL
                """,
                now,
                row["id"],
            )
            if updated != "UPDATE 1":
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

            user_exists = await conn.fetchval("SELECT 1 FROM users WHERE id = $1", row["user_id"])
            if not user_exists:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

            new_refresh_token = await _issue_refresh_token(conn, row["user_id"], now)

    new_access_token = create_jwt_token(data={"sub": row["user_id"]})
    _set_access_cookie(response, new_access_token)
    _set_refresh_cookie(response, new_refresh_token)
    return LoginResponse(
        access_token=new_access_token,
        expires_in=settings.jwt_expires_minutes * 60,
    )


@router.post("/logout")
async def logout(http_request: Request, response: Response):
    enforce_csrf_for_cookie_request(http_request)
    refresh_token = http_request.cookies.get(settings.refresh_cookie_name)
    if refresh_token:
        now = datetime.now(timezone.utc)
        async with get_connection() as conn:
            await conn.execute(
                """
                UPDATE auth_refresh_tokens
                SET revoked_at = $1
                WHERE token_hash = $2
                  AND revoked_at IS NULL
                """,
                now,
                hash_token(refresh_token),
            )

    cookie_domain = settings.auth_cookie_domain or None
    response.delete_cookie(
        key=settings.auth_cookie_name,
        path=settings.auth_cookie_path,
        domain=cookie_domain,
        secure=settings.auth_cookie_secure,
        httponly=True,
        samesite=settings.auth_cookie_samesite,
    )
    response.delete_cookie(
        key=settings.refresh_cookie_name,
        path=settings.auth_cookie_path,
        domain=cookie_domain,
        secure=settings.auth_cookie_secure,
        httponly=True,
        samesite=settings.auth_cookie_samesite,
    )
    return {"message": "Logged out"}
