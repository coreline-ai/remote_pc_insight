from pydantic_settings import BaseSettings
from functools import lru_cache
from pathlib import Path
from typing import List

_ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    # Runtime environment
    environment: str = "development"

    # Database
    database_url: str = "postgresql://postgres:postgres@localhost:5433/pcinsight_test"
    
    # JWT
    jwt_secret: str = "dev-local-jwt-secret-change-before-production-2026-02-14"
    jwt_algorithm: str = "HS256"
    jwt_expires_minutes: int = 60 * 24  # 1 day
    auth_cookie_name: str = "pcinsight_at"
    refresh_cookie_name: str = "pcinsight_rt"
    auth_cookie_secure: bool = False
    auth_cookie_samesite: str = "lax"
    auth_cookie_domain: str = ""
    auth_cookie_path: str = "/"
    refresh_token_expires_days: int = 30
    
    # Tokens
    enroll_token_expires_minutes: int = 60  # 1 hour
    device_token_expires_days: int = 365  # 1 year
    
    # CORS
    cors_origins: List[str] = ["http://localhost:3000", "http://localhost:3001", "http://localhost:3002"]
    trust_proxy_headers: bool = False
    trusted_hosts: List[str] = ["localhost", "127.0.0.1", "testserver"]
    enable_api_docs: bool = True
    
    # Logging
    log_level: str = "INFO"
    
    # Rate limiting
    rate_limit_requests: int = 100
    rate_limit_window_seconds: int = 60
    auth_login_rate_limit_requests: int = 10
    auth_login_rate_limit_window_seconds: int = 60
    auth_register_rate_limit_requests: int = 5
    auth_register_rate_limit_window_seconds: int = 60
    share_public_rate_limit_requests: int = 30
    share_public_rate_limit_window_seconds: int = 60
    redis_url: str = ""
    redis_rate_limit_prefix: str = "pcinsight:rl"
    
    # Payload limits
    max_report_size_bytes: int = 2 * 1024 * 1024  # 2MB
    
    # CSRF (cookie-auth state changing requests)
    enforce_csrf_for_cookie_auth: bool = True
    csrf_header_name: str = "x-pcinsight-csrf"
    csrf_cookie_name: str = "pcinsight_csrf"

    # AI Copilot
    enable_ai_copilot: bool = False
    ai_provider: str = "glm45"
    ai_model: str = "gpt-4o-mini"
    openai_model: str = "gpt-4o-mini"
    openai_base_url: str = "https://api.openai.com/v1/chat/completions"
    ai_timeout_seconds: float = 8.0
    ai_max_retries: int = 2
    ai_max_prompt_chars: int = 6000
    ai_rate_limit_per_minute: int = 60
    ai_cache_ttl_seconds: int = 900
    ai_prompt_version: str = "v1"
    ai_model_version: str = "default"
    openai_api_key: str = ""
    glm_model: str = "glm-4.5"
    glm_base_url: str = "https://open.bigmodel.cn/api/paas/v4/chat/completions"
    glm_api_key: str = ""
    glm_temperature: float = 0.0
    glm_thinking_type: str = "disabled"
    glm_timeout_seconds: float = 60.0

    # MVP test login (development/test only)
    mvp_test_login_enabled: bool = False
    mvp_test_login_email: str = ""
    mvp_test_login_password: str = ""

    class Config:
        env_file = str(_ENV_FILE)
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()


def validate_security_settings() -> None:
    env = settings.environment.lower()
    insecure_secret = (
        settings.jwt_secret in {
            "change-me-in-production",
            "change-me",
            "default-secret",
            "dev-local-jwt-secret-change-before-production-2026-02-14",
        }
        or len(settings.jwt_secret) < 32
    )
    if env not in {"production", "staging"}:
        return

    if insecure_secret:
        raise RuntimeError(
            "Insecure JWT configuration: set a strong JWT_SECRET (>=32 chars) for production/staging."
        )
    if not settings.auth_cookie_secure:
        raise RuntimeError(
            "Insecure cookie configuration: AUTH_COOKIE_SECURE must be true for production/staging."
        )
    if settings.enable_api_docs:
        raise RuntimeError(
            "API docs must be disabled in production/staging. Set ENABLE_API_DOCS=false."
        )
    if settings.mvp_test_login_enabled:
        raise RuntimeError(
            "MVP test login must be disabled in production/staging."
        )
