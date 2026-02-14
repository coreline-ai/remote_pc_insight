from contextlib import asynccontextmanager
import logging
import uuid

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware
from starlette.responses import Response

from app.api.v1.routers import agent, ai, auth, commands, devices, reports, tokens
from app.core.bootstrap import ensure_mvp_test_login_user
from app.core.config import settings, validate_security_settings
from app.core.database import close_pool, get_connection, init_db

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    validate_security_settings()
    try:
        await init_db()
        await ensure_mvp_test_login_user()
    except Exception as exc:
        logger.exception("Database initialization failed during startup. Exiting (fail-fast).")
        raise RuntimeError("Database initialization failed") from exc
    yield
    try:
        await close_pool()
    except Exception:
        logger.exception("Error while closing database pool")

app = FastAPI(
    title="pc-insight Cloud API",
    description="Backend API for pc-insight Cloud - Multi-device PC health management",
    version="0.1.0",
    docs_url="/docs" if settings.enable_api_docs else None,
    redoc_url="/redoc" if settings.enable_api_docs else None,
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

trusted_hosts = [host.strip() for host in settings.trusted_hosts if host.strip()]
if settings.environment.lower() in {"production", "staging"} and trusted_hosts:
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=trusted_hosts)

# API v1 routers
app.include_router(auth.router, prefix="/v1/auth", tags=["auth"])
app.include_router(tokens.router, prefix="/v1/tokens", tags=["tokens"])
app.include_router(devices.router, prefix="/v1/devices", tags=["devices"])
app.include_router(commands.router, prefix="/v1", tags=["commands"])
app.include_router(reports.router, prefix="/v1/reports", tags=["reports"])
app.include_router(agent.router, prefix="/v1/agent", tags=["agent"])
app.include_router(ai.router, prefix="/v1/ai", tags=["ai"])


@app.middleware("http")
async def trace_middleware(request: Request, call_next):
    trace_id = request.headers.get("X-Trace-Id") or uuid.uuid4().hex
    request.state.trace_id = trace_id
    response: Response = await call_next(request)
    response.headers["X-Trace-Id"] = trace_id
    return response


@app.get("/")
async def root():
    return {
        "name": "pc-insight Cloud API",
        "version": "0.1.0",
        "status": "healthy",
    }


@app.get("/health")
async def health():
    try:
        async with get_connection() as conn:
            await conn.fetchval("SELECT 1")
        return {"status": "ok", "database": "ok"}
    except Exception:
        return {"status": "degraded", "database": "unavailable"}
