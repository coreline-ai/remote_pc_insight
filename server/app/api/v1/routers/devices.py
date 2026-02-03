from fastapi import APIRouter, Depends, HTTPException, status
from datetime import datetime, timezone, timedelta
from typing import Optional

from app.api.v1.deps import get_current_user
from app.core.database import get_connection
from app.models import (
    DeviceResponse,
    DeviceListResponse,
    DeviceDetailResponse,
    CommandResponse,
    ReportSummary,
)

router = APIRouter()


@router.get("", response_model=DeviceListResponse)
async def list_devices(
    current_user: dict = Depends(get_current_user),
):
    """List all devices for the current user."""
    async with get_connection() as conn:
        rows = await conn.fetch("""
            SELECT id, name, platform, arch, agent_version, created_at, last_seen_at, revoked_at
            FROM devices
            WHERE user_id = $1
            ORDER BY last_seen_at DESC NULLS LAST, created_at DESC
        """, current_user["id"])
    
    now = datetime.now(timezone.utc)
    devices = []
    for row in rows:
        last_seen = row["last_seen_at"]
        is_online = last_seen and (now - last_seen) < timedelta(minutes=2)
        
        devices.append(DeviceResponse(
            id=row["id"],
            name=row["name"],
            platform=row["platform"],
            arch=row["arch"],
            agent_version=row["agent_version"],
            created_at=row["created_at"],
            last_seen_at=row["last_seen_at"],
            is_online=is_online,
            is_revoked=row["revoked_at"] is not None,
        ))
    
    return DeviceListResponse(devices=devices, total=len(devices))


@router.get("/{device_id}", response_model=DeviceDetailResponse)
async def get_device(
    device_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get device details with recent commands and latest report."""
    async with get_connection() as conn:
        # Get device
        device = await conn.fetchrow("""
            SELECT id, name, platform, arch, agent_version, created_at, last_seen_at, revoked_at
            FROM devices
            WHERE id = $1 AND user_id = $2
        """, device_id, current_user["id"])
        
        if not device:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Device not found",
            )
        
        # Get recent commands
        commands = await conn.fetch("""
            SELECT id, type, status, progress, message, created_at, started_at, finished_at, report_id
            FROM commands
            WHERE device_id = $1
            ORDER BY created_at DESC
            LIMIT 10
        """, device_id)
        
        # Get latest report
        report = await conn.fetchrow("""
            SELECT id, health_score, disk_free_percent, startup_apps_count, one_liner, created_at
            FROM reports
            WHERE device_id = $1
            ORDER BY created_at DESC
            LIMIT 1
        """, device_id)
    
    now = datetime.now(timezone.utc)
    last_seen = device["last_seen_at"]
    is_online = last_seen and (now - last_seen) < timedelta(minutes=2)
    
    return DeviceDetailResponse(
        id=device["id"],
        name=device["name"],
        platform=device["platform"],
        arch=device["arch"],
        agent_version=device["agent_version"],
        created_at=device["created_at"],
        last_seen_at=device["last_seen_at"],
        is_online=is_online,
        is_revoked=device["revoked_at"] is not None,
        recent_commands=[
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
        latest_report=ReportSummary(
            id=report["id"],
            health_score=report["health_score"],
            disk_free_percent=report["disk_free_percent"],
            startup_apps_count=report["startup_apps_count"],
            one_liner=report["one_liner"],
            created_at=report["created_at"],
        ) if report else None,
    )


@router.post("/{device_id}/revoke")
async def revoke_device(
    device_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Revoke a device and invalidate its tokens."""
    async with get_connection() as conn:
        # Verify ownership
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
                detail="Device already revoked",
            )
        
        # Revoke device and tokens
        now = datetime.now(timezone.utc)
        await conn.execute(
            "UPDATE devices SET revoked_at = $1 WHERE id = $2",
            now, device_id,
        )
        await conn.execute(
            "UPDATE device_tokens SET revoked_at = $1 WHERE device_id = $2",
            now, device_id,
        )
    
    return {"message": "Device revoked successfully"}


@router.delete("/{device_id}")
async def delete_device(
    device_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Permanently delete a device and all its history."""
    async with get_connection() as conn:
        # Verify ownership
        device = await conn.fetchrow("""
            SELECT id
            FROM devices
            WHERE id = $1 AND user_id = $2
        """, device_id, current_user["id"])
        
        if not device:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Device not found",
            )
        
        # Delete related data (cascade manually if not set in DB)
        # 1. Device Tokens
        await conn.execute("DELETE FROM device_tokens WHERE device_id = $1", device_id)
        
        # 2. Reports
        await conn.execute("DELETE FROM reports WHERE device_id = $1", device_id)
        
        # 3. Commands
        await conn.execute("DELETE FROM commands WHERE device_id = $1", device_id)
        
        # 4. The Device
        await conn.execute("DELETE FROM devices WHERE id = $1", device_id)
    
    return {"message": "Device deleted permanently"}
