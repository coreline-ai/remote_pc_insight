import logging
import base64
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi import Request

from app.api.v1.deps import get_current_user
from app.core.config import settings
from app.core.database import get_connection
from app.core.security import generate_id, generate_token, hash_token
from app.models import (
    ReportDetailResponse,
    ReportExportResponse,
    ReportShareItem,
    ReportShareListResponse,
    ReportShareResponse,
    SharedReportResponse,
)
from app.services.request_rate_limit import enforce_request_rate_limit

router = APIRouter()
logger = logging.getLogger(__name__)


def _sanitize_pdf_text(value: str) -> str:
    escaped = value.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
    return "".join(ch if 32 <= ord(ch) <= 126 else "?" for ch in escaped)


def _build_simple_pdf(lines: list[str]) -> bytes:
    page_lines = lines[:44]
    stream_lines = ["BT", "/F1 11 Tf", "14 TL", "50 770 Td"]
    for index, line in enumerate(page_lines):
        safe = _sanitize_pdf_text(line)
        if index == 0:
            stream_lines.append(f"({safe}) Tj")
        else:
            stream_lines.append(f"T* ({safe}) Tj")
    stream_lines.append("ET")
    stream_data = "\n".join(stream_lines).encode("latin-1", errors="replace")

    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
        b"<< /Length " + str(len(stream_data)).encode("ascii") + b" >>\nstream\n" + stream_data + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]

    pdf = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for index, obj in enumerate(objects, start=1):
        offsets.append(len(pdf))
        pdf.extend(f"{index} 0 obj\n".encode("ascii"))
        pdf.extend(obj)
        pdf.extend(b"\nendobj\n")

    startxref = len(pdf)
    pdf.extend(f"xref\n0 {len(objects) + 1}\n".encode("ascii"))
    pdf.extend(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        pdf.extend(f"{offset:010d} 00000 n \n".encode("ascii"))
    pdf.extend(
        (
            f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n"
            f"startxref\n{startxref}\n%%EOF\n"
        ).encode("ascii")
    )
    return bytes(pdf)


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
        logger.exception("Error fetching report")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        )


@router.get("/{report_id}/export", response_model=ReportExportResponse)
async def export_report(
    report_id: str,
    format: str = Query(default="markdown", pattern="^(markdown|text|pdf)$"),
    current_user: dict = Depends(get_current_user),
):
    async with get_connection() as conn:
        report = await conn.fetchrow(
            """
            SELECT r.id, r.created_at, r.health_score, r.disk_free_percent, r.startup_apps_count, r.one_liner,
                   d.name AS device_name
            FROM reports r
            JOIN devices d ON d.id = r.device_id
            WHERE r.id = $1 AND d.user_id = $2
            """,
            report_id,
            current_user["id"],
        )
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")

    text_lines = [
        f"Report {report['id']}",
        f"Device: {report['device_name']}",
        f"Created: {report['created_at']}",
        f"Health Score: {report['health_score']}",
        f"Disk Free Percent: {report['disk_free_percent']}",
        f"Startup Apps: {report['startup_apps_count']}",
        f"Summary: {report['one_liner'] or 'N/A'}",
    ]

    if format == "text":
        content = "\n".join(text_lines) + "\n"
        return ReportExportResponse(
            report_id=report_id,
            format=format,
            content=content,
            encoding="utf-8",
            filename=f"pc-insight-report-{report_id}.txt",
        )

    if format == "pdf":
        pdf_binary = _build_simple_pdf(text_lines)
        return ReportExportResponse(
            report_id=report_id,
            format=format,
            content=base64.b64encode(pdf_binary).decode("ascii"),
            encoding="base64",
            filename=f"pc-insight-report-{report_id}.pdf",
        )

    content = "\n".join(
        [
            f"# PC Insight Report ({report['id']})",
            "",
            f"- Device: **{report['device_name']}**",
            f"- Created: `{report['created_at']}`",
            f"- Health Score: **{report['health_score']}**",
            f"- Disk Free Percent: **{report['disk_free_percent']}%**",
            f"- Startup Apps: **{report['startup_apps_count']}**",
            "",
            "## Summary",
            report["one_liner"] or "N/A",
        ]
    )
    return ReportExportResponse(
        report_id=report_id,
        format=format,
        content=content,
        encoding="utf-8",
        filename=f"pc-insight-report-{report_id}.md",
    )


@router.post("/{report_id}/share", response_model=ReportShareResponse)
async def create_report_share(
    request: Request,
    report_id: str,
    expires_in_hours: int = Query(default=72, ge=1, le=720),
    current_user: dict = Depends(get_current_user),
):
    await enforce_request_rate_limit(request=request, scope=f"report:share:create:user:{current_user['id']}")
    async with get_connection() as conn:
        report = await conn.fetchrow(
            """
            SELECT r.id
            FROM reports r
            JOIN devices d ON d.id = r.device_id
            WHERE r.id = $1 AND d.user_id = $2
            """,
            report_id,
            current_user["id"],
        )
        if not report:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")

        share_id = generate_id("rsh")
        token = generate_token("shr")
        token_hash = hash_token(token)
        expires_at = datetime.now(timezone.utc) + timedelta(hours=expires_in_hours)
        await conn.execute(
            """
            INSERT INTO report_shares (id, report_id, user_id, share_token, share_token_hash, expires_at)
            VALUES ($1, $2, $3, $4, $5, $6)
            """,
            share_id,
            report_id,
            current_user["id"],
            None,
            token_hash,
            expires_at,
        )

    return ReportShareResponse(
        report_id=report_id,
        share_token=token,
        share_url=f"/v1/reports/share/{token}",
        expires_at=expires_at,
    )


@router.get("/{report_id}/shares", response_model=ReportShareListResponse)
async def list_report_shares(
    report_id: str,
    current_user: dict = Depends(get_current_user),
):
    async with get_connection() as conn:
        report = await conn.fetchrow(
            """
            SELECT r.id
            FROM reports r
            JOIN devices d ON d.id = r.device_id
            WHERE r.id = $1 AND d.user_id = $2
            """,
            report_id,
            current_user["id"],
        )
        if not report:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")

        rows = await conn.fetch(
            """
            SELECT id, share_token, expires_at, created_at, revoked_at
            FROM report_shares
            WHERE report_id = $1 AND user_id = $2
            ORDER BY created_at DESC
            """,
            report_id,
            current_user["id"],
        )

    return ReportShareListResponse(
        items=[
            ReportShareItem(
                share_id=row["id"],
                share_token=(row["share_token"] or ""),
                share_url=f"/v1/reports/share/{row['share_token']}" if row["share_token"] else "",
                expires_at=row["expires_at"],
                created_at=row["created_at"],
                revoked_at=row["revoked_at"],
            )
            for row in rows
        ]
    )


@router.post("/share/{share_ref}/revoke")
async def revoke_report_share(
    share_ref: str,
    current_user: dict = Depends(get_current_user),
):
    now = datetime.now(timezone.utc)
    share_hash = hash_token(share_ref)
    async with get_connection() as conn:
        result = await conn.execute(
            """
            UPDATE report_shares
            SET revoked_at = $1
            WHERE (id = $2 OR share_token = $2 OR share_token_hash = $3)
              AND user_id = $4
              AND revoked_at IS NULL
            """,
            now,
            share_ref,
            share_hash,
            current_user["id"],
        )
    if result != "UPDATE 1":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Share not found")
    return {"message": "Share revoked"}


@router.get("/share/{share_token}", response_model=SharedReportResponse)
async def get_shared_report(share_token: str, request: Request):
    await enforce_request_rate_limit(
        request=request,
        scope="report:share:public",
        limit=settings.share_public_rate_limit_requests,
        window_seconds=settings.share_public_rate_limit_window_seconds,
    )
    async with get_connection() as conn:
        share_hash = hash_token(share_token)
        row = await conn.fetchrow(
            """
            SELECT r.id AS report_id, r.created_at, r.one_liner, r.health_score, r.disk_free_percent, r.startup_apps_count,
                   d.name AS device_name, s.expires_at, s.revoked_at
            FROM report_shares s
            JOIN reports r ON r.id = s.report_id
            JOIN devices d ON d.id = r.device_id
            WHERE s.share_token_hash = $1 OR s.share_token = $2
            """,
            share_hash,
            share_token,
        )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Share not found")
    if row["revoked_at"] is not None or row["expires_at"] < datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Share link expired")

    return SharedReportResponse(
        report_id=row["report_id"],
        device_name=row["device_name"],
        created_at=row["created_at"],
        one_liner=row["one_liner"],
        health_score=row["health_score"],
        disk_free_percent=row["disk_free_percent"],
        startup_apps_count=row["startup_apps_count"],
    )
