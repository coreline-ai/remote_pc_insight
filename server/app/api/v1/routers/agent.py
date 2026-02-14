from datetime import datetime, timedelta, timezone
import json

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.api.v1.deps import verify_enroll_token, verify_device_token
from app.core.config import settings
from app.core.database import get_connection
from app.core.security import generate_id, generate_token, hash_token
from app.models import (
    AgentCommandPayload,
    AgentEnrollRequest,
    AgentEnrollResponse,
    AgentNextCommandResponse,
    AgentReportUpload,
    AgentStatusUpdate,
)
from app.services.request_rate_limit import enforce_request_rate_limit

router = APIRouter()


@router.post("/enroll", response_model=AgentEnrollResponse)
async def agent_enroll(
    request: AgentEnrollRequest,
    http_request: Request,
    token_info: dict = Depends(verify_enroll_token),
):
    """Enroll a new device using an enrollment token."""
    await enforce_request_rate_limit(request=http_request, scope="agent:enroll")
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=settings.device_token_expires_days)

    async with get_connection() as conn:
        async with conn.transaction():
            locked_token = await conn.fetchrow(
                """
                SELECT id, user_id, expires_at, used_at
                FROM enroll_tokens
                WHERE id = $1
                FOR UPDATE
                """,
                token_info["token_id"],
            )
            if not locked_token:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid enrollment token",
                )
            if locked_token["used_at"]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Enrollment token already used",
                )
            if locked_token["expires_at"] < now:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Enrollment token expired",
                )

            device_id = generate_id("dev")
            device_token = generate_token("devtok")
            device_token_hash = hash_token(device_token)
            device_token_id = generate_id("dt")
            fingerprint_hash = hash_token(request.device_fingerprint)

            await conn.execute(
                """
                INSERT INTO devices (
                    id, user_id, name, platform, arch, fingerprint_hash, agent_version, created_at,
                    last_seen_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
                """,
                device_id,
                locked_token["user_id"],
                request.device_name,
                request.platform,
                request.arch,
                fingerprint_hash,
                request.agent_version,
                now,
            )

            await conn.execute(
                """
                INSERT INTO device_tokens (id, device_id, token_hash, created_at, expires_at)
                VALUES ($1, $2, $3, $4, $5)
                """,
                device_token_id,
                device_id,
                device_token_hash,
                now,
                expires_at,
            )

            await conn.execute(
                """
                INSERT INTO device_settings (device_id, upload_level, created_at, updated_at)
                VALUES ($1, 0, $2, $2)
                """,
                device_id,
                now,
            )

            update_result = await conn.execute(
                """
                UPDATE enroll_tokens
                SET used_at = $1, used_device_id = $2
                WHERE id = $3
                  AND used_at IS NULL
                """,
                now,
                device_id,
                locked_token["id"],
            )
            if update_result != "UPDATE 1":
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Enrollment token already consumed",
                )

    return AgentEnrollResponse(
        device_id=device_id,
        device_token=device_token,
        expires_in=int(expires_at.timestamp() - now.timestamp()),
    )


@router.get("/commands/next", response_model=AgentNextCommandResponse)
async def get_next_command(
    http_request: Request,
    device: dict = Depends(verify_device_token),
):
    """Get the next queued command for this device."""
    await enforce_request_rate_limit(
        request=http_request,
        scope=f"agent:next:device:{device['device_id']}",
    )
    now = datetime.now(timezone.utc)

    async with get_connection() as conn:
        command = await conn.fetchrow(
            """
            WITH next_command AS (
                SELECT id
                FROM commands
                WHERE device_id = $1
                  AND status = 'queued'
                  AND (expires_at IS NULL OR expires_at > $2)
                ORDER BY created_at ASC
                FOR UPDATE SKIP LOCKED
                LIMIT 1
            )
            UPDATE commands c
            SET status = 'running',
                started_at = $2,
                progress = 0,
                message = 'Starting...'
            FROM next_command
            WHERE c.id = next_command.id
            RETURNING c.id, c.type, c.params_json, c.created_at
            """,
            device["device_id"],
            now,
        )

        if not command:
            return AgentNextCommandResponse(command=None)

    params = command["params_json"]
    if isinstance(params, str):
        try:
            params = json.loads(params)
        except json.JSONDecodeError:
            params = {}

    return AgentNextCommandResponse(
        command=AgentCommandPayload(
            id=command["id"],
            type=command["type"],
            params=params or {},
            issued_at=command["created_at"],
        ),
    )


@router.post("/commands/{command_id}/status")
async def update_command_status(
    command_id: str,
    request: AgentStatusUpdate,
    http_request: Request,
    device: dict = Depends(verify_device_token),
):
    """Update command status."""
    await enforce_request_rate_limit(
        request=http_request,
        scope=f"agent:status:device:{device['device_id']}",
    )
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
    http_request: Request,
    device: dict = Depends(verify_device_token),
):
    """Upload a report."""
    await enforce_request_rate_limit(
        request=http_request,
        scope=f"agent:report:device:{device['device_id']}",
    )
    report_id = generate_id("rpt")
    now = datetime.now(timezone.utc)
    
    # Extract summary fields from report
    report_data = request.report
    report_size = len(json.dumps(report_data, ensure_ascii=False).encode("utf-8"))
    if report_size > settings.max_report_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Report payload too large. Max {settings.max_report_size_bytes} bytes.",
        )
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
    http_request: Request,
    device: dict = Depends(verify_device_token),
):
    """Update device last_seen_at timestamp."""
    await enforce_request_rate_limit(
        request=http_request,
        scope=f"agent:heartbeat:device:{device['device_id']}",
    )
    # Last seen is already updated in verify_device_token
    return {"status": "ok", "device_id": device["device_id"]}
