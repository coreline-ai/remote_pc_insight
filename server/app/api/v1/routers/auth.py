
from fastapi import APIRouter, HTTPException, status
from app.core.database import get_connection
from app.core.security import verify_password, create_jwt_token, hash_password, generate_id
from app.core.config import settings
from app.models import LoginRequest, LoginResponse, UserCreate, UserResponse

router = APIRouter()

@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    async with get_connection() as conn:
        user = await conn.fetchrow(
            "SELECT id, email, password_hash FROM users WHERE email = $1",
            request.email
        )
        
        if not user or not verify_password(request.password, user["password_hash"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
            
        access_token = create_jwt_token(data={"sub": user["id"]})
        
        return LoginResponse(
            access_token=access_token,
            expires_in=settings.jwt_expires_minutes * 60
        )

@router.post("/register", response_model=UserResponse)
async def register(request: UserCreate):
    async with get_connection() as conn:
        # Check if user exists
        exists = await conn.fetchval(
            "SELECT 1 FROM users WHERE email = $1",
            request.email
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
        """, user_id, request.email, hashed_pwd)
        
        created_user = await conn.fetchrow(
            "SELECT id, email, created_at FROM users WHERE id = $1",
            user_id
        )
        
        return UserResponse(
            id=created_user["id"],
            email=created_user["email"],
            created_at=created_user["created_at"]
        )
