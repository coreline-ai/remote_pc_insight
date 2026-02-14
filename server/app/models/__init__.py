from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ========== User Models ==========

class UserCreate(BaseModel):
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: str = Field(min_length=8, max_length=128)


class UserResponse(BaseModel):
    id: str
    email: str
    created_at: datetime


class CurrentUserResponse(BaseModel):
    id: str
    email: str


class LoginRequest(BaseModel):
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    # Keep login backward-compatible for legacy accounts created before stricter signup rules.
    password: str = Field(min_length=1, max_length=128)


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


class EnrollTokenStatusRequest(BaseModel):
    token: str = Field(min_length=16, max_length=256)


class EnrollTokenStatusResponse(BaseModel):
    status: str = Field(pattern="^(pending|used|expired|not_found)$")
    expires_at: Optional[datetime] = None
    used_at: Optional[datetime] = None
    used_device_id: Optional[str] = None


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
    recent_commands: List["CommandResponse"] = Field(default_factory=list)
    latest_report: Optional["ReportSummary"] = None


class DeviceRiskItem(BaseModel):
    device_id: str
    device_name: str
    platform: str
    is_online: bool
    risk_score: int = Field(ge=0, le=100)
    risk_level: str = Field(pattern="^(low|medium|high)$")
    top_reasons: List[str] = Field(default_factory=list)
    latest_report_id: Optional[str] = None
    latest_report_at: Optional[datetime] = None


class DeviceRiskTopResponse(BaseModel):
    items: List[DeviceRiskItem] = Field(default_factory=list)
    total: int


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


# ========== AI Copilot Models ==========

class DeviceAiRecommendedAction(BaseModel):
    command_type: str
    label: str
    reason: str


class DeviceAiSummaryResponse(BaseModel):
    enabled: bool
    source: str
    summary: str
    risk_level: str = Field(default="unknown", pattern="^(low|medium|high|unknown)$")
    reasons: List[str] = Field(default_factory=list)
    recommended_actions: List[DeviceAiRecommendedAction] = Field(default_factory=list)
    based_on_report_id: Optional[str] = None
    generated_at: datetime


class AiMetricsResponse(BaseModel):
    requests_total: int
    requests_success: int
    requests_failed: int
    requests_rate_limited: int
    fallback_total: int


class AiVersionUsageItem(BaseModel):
    model_config = {"protected_namespaces": ()}

    prompt_version: str
    model_version: str
    count: int


class AiVersionInfoResponse(BaseModel):
    active_prompt_version: str
    active_model_version: str
    usages: List[AiVersionUsageItem] = Field(default_factory=list)


class AiQueryRequest(BaseModel):
    query: str = Field(min_length=3, max_length=200)
    limit: int = Field(default=5, ge=1, le=20)


class AiQueryItem(BaseModel):
    device_id: str
    device_name: str
    score: int
    reason: str


class AiQueryResponse(BaseModel):
    query: str
    intent: str
    answer: str
    items: List[AiQueryItem] = Field(default_factory=list)


class DeviceTrendSignal(BaseModel):
    metric: str
    current: Optional[float] = None
    baseline: Optional[float] = None
    delta: Optional[float] = None
    status: str = Field(pattern="^(stable|improved|degraded|unknown)$")
    note: str


class DeviceTrendResponse(BaseModel):
    device_id: str
    period_days: int
    signals: List[DeviceTrendSignal] = Field(default_factory=list)
    summary: str


class ReportExportResponse(BaseModel):
    report_id: str
    format: str
    content: str
    encoding: str = "utf-8"
    filename: Optional[str] = None


class ReportShareResponse(BaseModel):
    report_id: str
    share_token: str
    share_url: str
    expires_at: datetime


class ReportShareItem(BaseModel):
    share_id: str
    share_token: str = ""
    share_url: str = ""
    expires_at: datetime
    created_at: datetime
    revoked_at: Optional[datetime] = None


class ReportShareListResponse(BaseModel):
    items: List[ReportShareItem] = Field(default_factory=list)


class SharedReportResponse(BaseModel):
    report_id: str
    device_name: Optional[str] = None
    created_at: datetime
    one_liner: Optional[str] = None
    health_score: Optional[int] = None
    disk_free_percent: Optional[float] = None
    startup_apps_count: Optional[int] = None


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


class AgentCommandPayload(BaseModel):
    id: str
    type: str
    params: Dict[str, Any] = Field(default_factory=dict)
    issued_at: datetime


class AgentNextCommandResponse(BaseModel):
    command: Optional[AgentCommandPayload] = None


class AgentStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(running|succeeded|failed)$")
    progress: int = Field(default=0, ge=0, le=100)
    message: str = ""


class AgentReportUpload(BaseModel):
    command_id: Optional[str] = None
    report: Dict[str, Any]


# Forward references
DeviceDetailResponse.model_rebuild()
