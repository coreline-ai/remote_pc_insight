# API.md — HTTP API Specification (MVP)

## Auth
- Web API: 사용자 인증 필요 (JWT/세션 권장)
- Agent API: Authorization: Bearer <DEVICE_TOKEN>
- Enrollment: Authorization: Bearer <ENROLL_TOKEN>

---

## 1) Web APIs

### 1.1 Create Enrollment Token
- POST /v1/tokens/enroll
- Query: ttl_minutes (optional)
- Response:
  - enroll_token (plain)
  - expires_at
  - ttl_minutes

### 1.2 List Devices
- GET /v1/devices
- Response: devices[]

### 1.3 Get Device
- GET /v1/devices/{device_id}
- Response:
  - device
  - latest_report (nullable)

### 1.4 Create Command
- POST /v1/devices/{device_id}/commands
- Body:
  - type: RUN_FULL | RUN_DEEP | RUN_STORAGE_ONLY | RUN_PRIVACY_ONLY | RUN_DOWNLOADS_TOP | PING
  - params: json (optional)
- Response:
  - command_id
  - status: queued

### 1.5 List Commands
- GET /v1/devices/{device_id}/commands?limit=50
- Response: commands[]

### 1.6 Get Report
- GET /v1/reports/{report_id}
- Response:
  - id, device_id, created_at
  - summary
  - raw_report (MVP)

### 1.7 Revoke Device
- POST /v1/devices/{device_id}/revoke
- Response: { ok: true }

---

## 2) Agent APIs

### 2.1 Enroll Device
- POST /v1/agent/enroll
- Auth: Bearer <ENROLL_TOKEN>
- Body:
  - device_name, platform, arch, agent_version, device_fingerprint
- Response:
  - device_id
  - device_token (plain, 1회)
  - expires_in

### 2.2 Next Command
- GET /v1/agent/commands/next
- Auth: Bearer <DEVICE_TOKEN>
- Response:
  - command: null | { id, type, params, issued_at }

### 2.3 Update Command Status
- POST /v1/agent/commands/{command_id}/status
- Auth: Bearer <DEVICE_TOKEN>
- Body:
  - status: running|succeeded|failed
  - progress: 0..100
  - message: string

### 2.4 Upload Report
- POST /v1/agent/reports
- Auth: Bearer <DEVICE_TOKEN>
- Body:
  - command_id (optional)
  - report (json)

---
