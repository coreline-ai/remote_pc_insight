from fastapi import APIRouter, Depends, HTTPException, status
from datetime import datetime, timedelta, timezone
import json

from app.api.v1.deps import get_current_user
from app.core.database import get_connection
from app.core.security import generate_id
from app.models import (
    CommandCreate,
    CommandResponse,
    CommandListResponse,
)

router = APIRouter()

# Allowed command types
ALLOWED_COMMAND_TYPES = {
    "RUN_FULL",
    "RUN_DEEP",
    "RUN_STORAGE_ONLY",
    "RUN_PRIVACY_ONLY",
    "RUN_DOWNLOADS_TOP",
    "PING",
}


@router.post("/devices/{device_id}/commands", response_model=CommandResponse)
async def create_command(
    device_id: str,
    request: CommandCreate,
    current_user: dict = Depends(get_current_user),
):
    """Create a new command for a device."""
    # Validate command type
    if request.type not in ALLOWED_COMMAND_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid command type. Allowed: {', '.join(ALLOWED_COMMAND_TYPES)}",
        )
    
    async with get_connection() as conn:
        # Verify device ownership
        device = await conn.fetchrow("""
            SELECT id, revoked_at
            FROM devices
            WHERE id = $1 AND user_id = $2
        """, device_id, current_user["id"])
        
        if not device:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Device not found",
            )
        
        if device["revoked_at"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Device is revoked",
            )
        
        # Create command
        command_id = generate_id("cmd")
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(hours=24)  # Default 24h TTL
        
        await conn.execute("""
            INSERT INTO commands (id, device_id, user_id, type, params_json, status, expires_at, created_at)
            VALUES ($1, $2, $3, $4, $5, 'queued', $6, $7)
        """, command_id, device_id, current_user["id"], request.type, json.dumps(request.params), expires_at, now)
    
    return CommandResponse(
        id=command_id,
        type=request.type,
        status="queued",
        progress=0,
        message="",
        created_at=now,
        started_at=None,
        finished_at=None,
        report_id=None,
    )


@router.get("/devices/{device_id}/commands", response_model=CommandListResponse)
async def list_commands(
    device_id: str,
    limit: int = 20,
    offset: int = 0,
    current_user: dict = Depends(get_current_user),
):
    """List commands for a device."""
    async with get_connection() as conn:
        # Verify ownership
        device = await conn.fetchrow(
            "SELECT id FROM devices WHERE id = $1 AND user_id = $2",
            device_id, current_user["id"],
        )
        
        if not device:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Device not found",
            )
        
        # Get commands
        commands = await conn.fetch("""
            SELECT id, type, status, progress, message, created_at, started_at, finished_at, report_id
            FROM commands
            WHERE device_id = $1
            ORDER BY created_at DESC
            LIMIT $2 OFFSET $3
        """, device_id, limit, offset)
        
        # Get total count
        total = await conn.fetchval(
            "SELECT COUNT(*) FROM commands WHERE device_id = $1",
            device_id,
        )
    
    return CommandListResponse(
        commands=[
            CommandResponse(
                id=cmd["id"],
                type=cmd["type"],
                status=cmd["status"],
                progress=cmd["progress"],
                message=cmd["message"],
                created_at=cmd["created_at"],
                started_at=cmd["started_at"],
                finished_at=cmd["finished_at"],
                report_id=cmd["report_id"],
            )
            for cmd in commands
        ],
        total=total,
    )


@router.get("/commands/{command_id}", response_model=CommandResponse)
async def get_command(
    command_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get command details."""
    async with get_connection() as conn:
        command = await conn.fetchrow("""
            SELECT c.id, c.type, c.status, c.progress, c.message, 
                   c.created_at, c.started_at, c.finished_at, c.report_id
            FROM commands c
            JOIN devices d ON c.device_id = d.id
            WHERE c.id = $1 AND d.user_id = $2
        """, command_id, current_user["id"])
        
        if not command:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Command not found",
            )
    
    return CommandResponse(
        id=command["id"],
        type=command["type"],
        status=command["status"],
        progress=command["progress"],
        message=command["message"],
        created_at=command["created_at"],
        started_at=command["started_at"],
        finished_at=command["finished_at"],
        report_id=command["report_id"],
    )
