# API_SPEC.md — pc-insight Cloud HTTP API Specification
Version: 0.9 (Draft)
Date: 2026-02-03
Status: MVP → v1 기준

---

## 0) 코드블럭 깨짐 방지 규칙
- 본 문서는 **단일 md 코드블럭** 안에서만 제공됨
- 내부에 추가 fenced code block(백틱 3개) 절대 사용 금지
- JSON / 예시는 서술형 또는 들여쓰기(4칸)로만 표현
- 실제 구현 시 OpenAPI(Swagger)로 자동 생성 권장

---

## 1) API 공통 규칙

### 1.1 Base URL
- 개발: http://localhost:8000
- 운영: https://api.pc-insight.example

모든 API는 `/v1` prefix 사용

---

### 1.2 인증 방식 요약

#### Web API (사용자)
- 방식: JWT 또는 세션 기반 인증 (MVP 이후 필수)
- 헤더 예시:
  - Authorization: Bearer <USER_JWT>

#### Agent API (디바이스)
- 방식: Device Token
- 헤더:
  - Authorization: Bearer <DEVICE_TOKEN>

#### Enrollment API
- 방식: Enrollment Token (1회성)
- 헤더:
  - Authorization: Bearer <ENROLL_TOKEN>

---

### 1.3 공통 응답 포맷 (권장)

성공:
- HTTP 200/201
- JSON body

실패:
- HTTP 4xx / 5xx
- JSON:
  - error: string
  - message: string
  - code: optional string

---

### 1.4 공통 에러 코드 예시
- AUTH_REQUIRED
- AUTH_INVALID
- TOKEN_EXPIRED
- DEVICE_REVOKED
- COMMAND_NOT_ALLOWED
- NOT_FOUND
- RATE_LIMITED
- INTERNAL_ERROR

---

## 2) Web API (사용자 인증 필요)

---

### 2.1 Enrollment Token 발급 (새 PC 연결)

- Method: POST
- Path: /v1/tokens/enroll
- Auth: User

Query Params:
- ttl_minutes (optional, int, default 60)

Response:
- enroll_token: string (plain, 1회 노출)
- expires_at: ISO-8601 string
- ttl_minutes: int

비고:
- token은 DB에 hash로만 저장
- expires_at 이후 사용 불가

---

### 2.2 디바이스 목록 조회

- Method: GET
- Path: /v1/devices
- Auth: User

Response:
- devices: array
  - id: string
  - name: string
  - platform: string
  - arch: string
  - agent_version: string
  - last_seen_at: ISO-8601 or null
  - latest_score: int or null
  - latest_one_liner: string or null
  - latest_report_at: ISO-8601 or null

---

### 2.3 디바이스 상세 조회

- Method: GET
- Path: /v1/devices/{device_id}
- Auth: User

Path Params:
- device_id: string

Response:
- device:
  - id
  - name
  - platform
  - arch
  - agent_version
  - created_at
  - last_seen_at
- latest_report: object or null
  - id
  - created_at
  - health_score
  - disk_free_percent
  - startup_apps_count
  - one_liner

---

### 2.4 원격 명령 생성

- Method: POST
- Path: /v1/devices/{device_id}/commands
- Auth: User

Path Params:
- device_id: string

Body:
- type: string (allowlist)
- params: object (optional)

Allowlist type:
- RUN_FULL
- RUN_DEEP
- RUN_STORAGE_ONLY
- RUN_PRIVACY_ONLY
- RUN_DOWNLOADS_TOP
- PING

Params 예시:
- include_paths: boolean
- include_file_names: boolean
- show_process_names: boolean

Response:
- command_id: string
- status: queued

에러:
- DEVICE_REVOKED
- COMMAND_NOT_ALLOWED

---

### 2.5 디바이스 명령 히스토리

- Method: GET
- Path: /v1/devices/{device_id}/commands
- Auth: User

Query Params:
- limit (optional, default 50)

Response:
- commands: array
  - id
  - type
  - status
  - progress (0~100)
  - message
  - created_at
  - started_at
  - finished_at
  - report_id or null

---

### 2.6 리포트 상세 조회

- Method: GET
- Path: /v1/reports/{report_id}
- Auth: User

Path Params:
- report_id: string

Response:
- id
- device_id
- created_at
- summary:
  - health_score
  - disk_free_percent
  - startup_apps_count
  - one_liner
- raw_report: object (upload policy에 따라 마스킹)

---

### 2.7 디바이스 연결 해제 (Revoke)

- Method: POST
- Path: /v1/devices/{device_id}/revoke
- Auth: User

Response:
- ok: true

비고:
- revoke 이후 해당 디바이스는 모든 agent API 접근 차단

---

### 2.8 (v1) 디바이스 정책 설정

- Method: PUT
- Path: /v1/devices/{device_id}/settings
- Auth: User

Body:
- upload_level: int (0, 1, 2)

Response:
- device_id
- upload_level
- updated_at

---

## 3) Agent API (DEVICE_TOKEN 필요)

---

### 3.1 디바이스 등록 (Enroll)

- Method: POST
- Path: /v1/agent/enroll
- Auth: Bearer ENROLL_TOKEN

Body:
- device_name: string
- platform: string
- arch: string
- agent_version: string
- device_fingerprint: string

Response:
- device_id: string
- device_token: string (plain, 1회 노출)
- expires_in: seconds

에러:
- TOKEN_EXPIRED
- TOKEN_USED
- AUTH_INVALID

---

### 3.2 다음 명령 수신 (Polling)

- Method: GET
- Path: /v1/agent/commands/next
- Auth: Bearer DEVICE_TOKEN

Response:
- command: null
또는
- command:
  - id: string
  - type: string
  - params: object
  - issued_at: ISO-8601

서버 동작:
- expired 명령 정리
- queued → running 전환 (트랜잭션)

---

### 3.3 명령 상태 업데이트

- Method: POST
- Path: /v1/agent/commands/{command_id}/status
- Auth: Bearer DEVICE_TOKEN

Path Params:
- command_id: string

Body:
- status: running | succeeded | failed
- progress: int (0~100)
- message: string

비고:
- running 상태에서는 progress 업데이트 허용
- succeeded/failed는 1회만 허용(권장)

---

### 3.4 리포트 업로드

- Method: POST
- Path: /v1/agent/reports
- Auth: Bearer DEVICE_TOKEN

Body:
- command_id: string (optional)
- report: object (sanitized JSON)

서버 처리:
- 요약 컬럼 추출
- upload_level 정책 적용
- reports 테이블 저장
- command_id가 있으면 commands 상태를 succeeded로 전환

---

### 3.5 (v1 권장) Agent Heartbeat

- Method: POST
- Path: /v1/agent/heartbeat
- Auth: Bearer DEVICE_TOKEN

Body:
- agent_version: string
- capabilities: object (optional)

서버 처리:
- devices.last_seen_at 업데이트
- 최소 지원 버전 미만이면 경고 반환 가능

---

## 4) 상태 전이 규칙 (Command Lifecycle)

- queued → running → succeeded
- queued → running → failed
- queued → expired (TTL 초과)
- queued/running → canceled (v1+)

제약:
- running 전환은 서버만 수행
- expired는 서버에서만 처리
- agent는 allowlist type만 실행

---

## 5) Rate Limit / 제한 (권장)

Web:
- enroll token 발급: 사용자당 분당 N회
- command 생성: 사용자당 분당 N회

Agent:
- commands/next: 디바이스당 초당 1회 권장
- reports upload: 디바이스당 분당 N회

---

## 6) 보안 주의사항

- 토큰은 절대 로그에 남기지 않는다
- report payload 크기 제한 적용 권장
- params는 strict schema 검증
- raw_report는 서버에서 재마스킹 권장

---

## 7) 버전 관리

- API 버전은 URL prefix(/v1)로 관리
- breaking change 시 /v2로 분리
- agent는 최소 지원 API 버전 체크 권장

---
