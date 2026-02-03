from fastapi import APIRouter, Depends, HTTPException, status
from datetime import datetime, timedelta, timezone
import json

from app.api.v1.deps import verify_enroll_token, verify_device_token
from app.core.database import get_connection
from app.core.security import generate_token, hash_token, generate_id
from app.core.config import settings
from app.models import (
    AgentEnrollRequest,
    AgentEnrollResponse,
    AgentNextCommandResponse,
    AgentStatusUpdate,
    AgentReportUpload,
    CommandResponse,
)

router = APIRouter()


@router.post("/enroll", response_model=AgentEnrollResponse)
async def agent_enroll(
    request: AgentEnrollRequest,
    token_info: dict = Depends(verify_enroll_token),
):
    """Enroll a new device using an enrollment token."""
    device_id = generate_id("dev")
    device_token = generate_token("devtok")
    device_token_hash = hash_token(device_token)
    device_token_id = generate_id("dt")
    fingerprint_hash = hash_token(request.device_fingerprint)
    
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=settings.device_token_expires_days)
    
    async with get_connection() as conn:
        # Create device
        await conn.execute("""
            INSERT INTO devices (id, user_id, name, platform, arch, fingerprint_hash, agent_version, created_at, last_seen_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
        """, device_id, token_info["user_id"], request.device_name, request.platform, 
             request.arch, fingerprint_hash, request.agent_version, now)
        
        # Create device token
        await conn.execute("""
            INSERT INTO device_tokens (id, device_id, token_hash, created_at, expires_at)
            VALUES ($1, $2, $3, $4, $5)
        """, device_token_id, device_id, device_token_hash, now, expires_at)
        
        # Create default device settings
        await conn.execute("""
            INSERT INTO device_settings (device_id, upload_level, created_at, updated_at)
            VALUES ($1, 0, $2, $2)
        """, device_id, now)
        
        # Mark enrollment token as used
        await conn.execute("""
            UPDATE enroll_tokens SET used_at = $1 WHERE id = $2
        """, now, token_info["token_id"])
    
    return AgentEnrollResponse(
        device_id=device_id,
        device_token=device_token,
        expires_in=int(expires_at.timestamp() - now.timestamp()),
    )


@router.get("/commands/next", response_model=AgentNextCommandResponse)
async def get_next_command(
    device: dict = Depends(verify_device_token),
):
    """Get the next queued command for this device."""
    now = datetime.now(timezone.utc)
    
    async with get_connection() as conn:
        # Get next queued command (oldest first)
        command = await conn.fetchrow("""
            SELECT id, type, params_json, created_at
            FROM commands
            WHERE device_id = $1
              AND status = 'queued'
              AND (expires_at IS NULL OR expires_at > $2)
            ORDER BY created_at ASC
            LIMIT 1
        """, device["device_id"], now)
        
        if not command:
            return AgentNextCommandResponse(command=None)
        
        # Update status to running
        await conn.execute("""
            UPDATE commands
            SET status = 'running', started_at = $1, progress = 0, message = 'Starting...'
            WHERE id = $2
        """, now, command["id"])
    
    return AgentNextCommandResponse(
        command=CommandResponse(
            id=command["id"],
            type=command["type"],
            status="running",
            progress=0,
            message="Starting...",
            created_at=command["created_at"],
            started_at=now,
            finished_at=None,
            report_id=None,
        ),
    )


@router.post("/commands/{command_id}/status")
async def update_command_status(
    command_id: str,
    request: AgentStatusUpdate,
    device: dict = Depends(verify_device_token),
):
    """Update command status."""
    now = datetime.now(timezone.utc)
    
    async with get_connection() as conn:
        # Verify command belongs to this device
        command = await conn.fetchrow(
            "SELECT id, status FROM commands WHERE id = $1 AND device_id = $2",
            command_id, device["device_id"],
        )
        
        if not command:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Command not found",
            )
        
        # Update status
        finished_at = now if request.status in ("succeeded", "failed") else None
        await conn.execute("""
            UPDATE commands
            SET status = $1, progress = $2, message = $3, finished_at = $4
            WHERE id = $5
        """, request.status, request.progress, request.message, finished_at, command_id)
    
    return {"message": "Status updated"}


@router.post("/reports")
async def upload_report(
    request: AgentReportUpload,
    device: dict = Depends(verify_device_token),
):
    """Upload a report."""
    report_id = generate_id("rpt")
    now = datetime.now(timezone.utc)
    
    # Extract summary fields from report
    report_data = request.report
    health_score = report_data.get("healthScore")
    disk_free_percent = report_data.get("diskFreePercent")
    startup_apps_count = report_data.get("startupAppsCount")
    one_liner = report_data.get("oneLiner")
    
    async with get_connection() as conn:
        # Insert report
        await conn.execute("""
            INSERT INTO reports (id, device_id, command_id, created_at, 
                               health_score, disk_free_percent, startup_apps_count, 
                               one_liner, raw_report_json)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        """, report_id, device["device_id"], request.command_id, now,
             health_score, disk_free_percent, startup_apps_count, one_liner,
             json.dumps(report_data))
        
        # Update command if linked
        if request.command_id:
            await conn.execute("""
                UPDATE commands
                SET status = 'succeeded', progress = 100, 
                    message = 'Report uploaded', finished_at = $1, report_id = $2
                WHERE id = $3 AND device_id = $4
            """, now, report_id, request.command_id, device["device_id"])
    
    return {"report_id": report_id, "message": "Report uploaded successfully"}


@router.post("/heartbeat")
async def heartbeat(
    device: dict = Depends(verify_device_token),
):
    """Update device last_seen_at timestamp."""
    # Last seen is already updated in verify_device_token
    return {"status": "ok", "device_id": device["device_id"]}
