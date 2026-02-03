from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.routers import tokens, devices, commands, reports, agent, auth
from app.core.config import settings

app = FastAPI(
    title="pc-insight Cloud API",
    description="Backend API for pc-insight Cloud - Multi-device PC health management",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API v1 routers
app.include_router(auth.router, prefix="/v1/auth", tags=["auth"])
app.include_router(tokens.router, prefix="/v1/tokens", tags=["tokens"])
app.include_router(devices.router, prefix="/v1/devices", tags=["devices"])
app.include_router(commands.router, prefix="/v1", tags=["commands"])
app.include_router(reports.router, prefix="/v1/reports", tags=["reports"])
app.include_router(agent.router, prefix="/v1/agent", tags=["agent"])


@app.get("/")
async def root():
    return {
        "name": "pc-insight Cloud API",
        "version": "0.1.0",
        "status": "healthy",
    }


@app.get("/health")
async def health():
    return {"status": "ok"}

