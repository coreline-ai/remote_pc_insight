from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, Dict, Any, List


# ========== User Models ==========

class UserCreate(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    id: str
    email: str
    created_at: datetime


class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


# ========== Token Models ==========

class EnrollTokenCreate(BaseModel):
    expires_in_minutes: int = Field(default=60, ge=5, le=1440)


class EnrollTokenResponse(BaseModel):
    token: str
    expires_at: datetime


# ========== Device Models ==========

class DeviceResponse(BaseModel):
    id: str
    name: str
    platform: str
    arch: str
    agent_version: Optional[str] = None
    created_at: datetime
    last_seen_at: Optional[datetime] = None
    is_online: bool = False
    is_revoked: bool = False


class DeviceListResponse(BaseModel):
    devices: List[DeviceResponse]
    total: int


class DeviceDetailResponse(DeviceResponse):
    recent_commands: List["CommandResponse"] = []
    latest_report: Optional["ReportSummary"] = None


# ========== Command Models ==========

class CommandCreate(BaseModel):
    type: str = Field(..., pattern="^(RUN_FULL|RUN_DEEP|RUN_STORAGE_ONLY|RUN_PRIVACY_ONLY|RUN_DOWNLOADS_TOP|PING)$")
    params: Dict[str, Any] = Field(default_factory=dict)


class CommandResponse(BaseModel):
    id: str
    type: str
    status: str
    progress: int = 0
    message: str = ""
    created_at: datetime
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    report_id: Optional[str] = None


class CommandListResponse(BaseModel):
    commands: List[CommandResponse]
    total: int


# ========== Report Models ==========

class ReportSummary(BaseModel):
    id: str
    health_score: Optional[int] = None
    disk_free_percent: Optional[float] = None
    startup_apps_count: Optional[int] = None
    one_liner: Optional[str] = None
    created_at: datetime


class ReportDetailResponse(ReportSummary):
    device_id: str
    command_id: Optional[str] = None
    raw_report_json: Optional[Dict[str, Any]] = None


# ========== Agent Models ==========

class AgentEnrollRequest(BaseModel):
    device_name: str
    platform: str
    arch: str
    agent_version: str
    device_fingerprint: str


class AgentEnrollResponse(BaseModel):
    device_id: str
    device_token: str
    expires_in: int  # seconds


class AgentNextCommandResponse(BaseModel):
    command: Optional[CommandResponse] = None


class AgentStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(running|succeeded|failed)$")
    progress: int = Field(default=0, ge=0, le=100)
    message: str = ""


class AgentReportUpload(BaseModel):
    command_id: Optional[str] = None
    report: Dict[str, Any]


# Forward references
DeviceDetailResponse.model_rebuild()
