from fastapi import APIRouter, Depends, HTTPException, status

from app.api.v1.deps import get_current_user
from app.core.database import get_connection
from app.models import ReportSummary, ReportDetailResponse

router = APIRouter()


@router.get("/{report_id}", response_model=ReportDetailResponse)
async def get_report(
    report_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get report details."""
    import json
    try:
        async with get_connection() as conn:
            report = await conn.fetchrow("""
                SELECT r.id, r.device_id, r.command_id, r.created_at,
                       r.health_score, r.disk_free_percent, r.startup_apps_count,
                       r.one_liner, r.raw_report_json
                FROM reports r
                JOIN devices d ON r.device_id = d.id
                WHERE r.id = $1 AND d.user_id = $2
            """, report_id, current_user["id"])
            
            if not report:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Report not found",
                )
                
            raw_data = report["raw_report_json"]
            # Handle case where asyncpg returns JSONB as string
            if isinstance(raw_data, str):
                try:
                    raw_data = json.loads(raw_data)
                except Exception:
                    pass # Keep as is or handle error, Pydantic will validate
            
            return ReportDetailResponse(
                id=report["id"],
                device_id=report["device_id"],
                command_id=report["command_id"],
                created_at=report["created_at"],
                health_score=report["health_score"],
                disk_free_percent=report["disk_free_percent"],
                startup_apps_count=report["startup_apps_count"],
                one_liner=report["one_liner"],
                raw_report_json=raw_data,
            )
            
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        print(f"Error fetching report: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}",
        )
