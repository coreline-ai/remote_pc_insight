from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import List


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql://postgres:postgres@localhost:5433/pcinsight_test"
    
    # JWT
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expires_minutes: int = 60 * 24  # 1 day
    
    # Tokens
    enroll_token_expires_minutes: int = 60  # 1 hour
    device_token_expires_days: int = 365  # 1 year
    
    # CORS
    cors_origins: List[str] = ["http://localhost:3000", "http://localhost:3001", "http://localhost:3002"]
    
    # Logging
    log_level: str = "INFO"
    
    # Rate limiting
    rate_limit_requests: int = 100
    rate_limit_window_seconds: int = 60
    
    # Payload limits
    max_report_size_bytes: int = 2 * 1024 * 1024  # 2MB

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
