# TRD — pc-insight Cloud (멀티 디바이스 PC 건강검진 · 정리 코치 · 원격 운영 대시보드)
Version: 0.9 (Draft)
Owner: Hwan Choi
Date: 2026-02-03
Status: Draft (MVP~v1 구현 기준)

---

## 0) 코드블럭 깨짐 사전 원인 분석 (문서 작성 규칙)

이 TRD는 **단일 fenced code block(```md ... ```)** 안에만 존재하도록 구성했습니다. 아래 규칙을 지키면 코드블럭이 깨지지 않습니다.

### 자주 깨지는 원인
1. 본문에 ``` 또는 ~~~ 문자열이 다시 등장(중첩 fenced code block)
2. 예시 코드를 보여주려다가 또 fenced code block을 넣음
3. 복사/붙여넣기 과정에서 백틱 개수 변화, 공백/개행 손상
4. 마크다운 자동 포맷터가 코드블럭 경계를 변형
5. 표/리스트 중간에 백틱이 잘못 닫히는 경우

### 방지 전략 (본 문서 적용)
- 내부에 **추가 fenced code block을 절대 사용하지 않음**
- 코드/명령 예시는 **인라인 코드(`...`)** 또는 **4칸 들여쓰기**로만 표현
- ``` 문자열을 본문에서 다시 쓰지 않음(설명 문장에서도 회피)
- 문서 끝에서만 블럭을 닫음

---

## 1) 시스템 개요 (System Overview)

pc-insight Cloud는 다음 3개의 실행 환경을 가진다.

1) Agent (CLI)
- 사용자 PC에서 실행되는 로컬 분석 에이전트
- 로컬 파일 시스템 스캔/요약/중복 추정/프라이버시 흔적 요약
- 서버 명령 큐를 폴링하여 원격 실행을 수행
- 결과 리포트를 서버로 업로드
- 오프라인(outbox) 재시도/중복 실행 방지(processed store)

2) Backend (FastAPI)
- 사용자 인증(웹 로그인) 및 리소스 권한 제어
- Enrollment Token 발급 및 Device 등록(Agent enroll)
- Device Token 기반 Agent 인증
- Command Queue 생성/상태 관리
- Report 저장/요약 컬럼 추출/조회 API
- 업로드 정책(경로/파일명) 강제 적용(서버가 최종 판단)

3) Web Frontend (Next.js)
- 디바이스 목록/상세/커맨드 진행률/히스토리
- 리포트 요약 및 상세(초기: Raw JSON)
- 새 PC 연결(Enrollment Token 발급 + 명령어 복사)
- 디바이스 revoke, 정책 설정(업로드 레벨)(v1)

---

## 2) 기술 스택 (Technology Stack)

### 2.1 Agent (CLI)
- Runtime: Node.js LTS (권장 20+)
- Language: TypeScript
- Packaging: npm package (bin 제공)
- Command framework: commander (or yargs)
- HTTP: fetch 기반
- Local storage:
  - `~/.pc-insight/config.json` (device token 등)
  - `~/.pc-insight/outbox/*.json` (업로드 재시도 큐)
  - `~/.pc-insight/processed.json` (명령 중복 실행 방지)
- OS integration (v1):
  - macOS: launchd (LaunchAgent)
  - Windows: Task Scheduler
  - Linux: systemd --user

### 2.2 Backend (FastAPI)
- Framework: FastAPI + Uvicorn
- DB: PostgreSQL
- DB driver: asyncpg (또는 SQLAlchemy async로 교체 가능)
- Auth (MVP -> v1):
  - MVP: Email+Password or OAuth 1종 (권장: GitHub OAuth)
  - v1: JWT access + refresh, secure cookies(웹)
- Observability: Sentry (서버), Prometheus/Grafana(선택)
- Deployment: Docker + managed Postgres

### 2.3 Web (Next.js)
- Next.js App Router
- Fetch wrapper + (v1) React Query/SWR
- 폴링 기반 진행률 갱신(MVP)
- WebSocket/SSE(vNext)

---

## 3) 아키텍처 상세 (Architecture Details)

### 3.1 데이터 흐름 (Data Flow)

A) 디바이스 등록
- Web: `POST /v1/tokens/enroll` -> Enrollment Token 발급
- Agent: `pc-insight link <ENROLL_TOKEN> --server <API_BASE>`
- Agent -> Server: `POST /v1/agent/enroll` (Authorization: Bearer <ENROLL_TOKEN>)
- Server -> Agent: device_id + device_token(1회 반환)
- Agent: `config.json` 저장

B) 원격 명령 실행
- Web -> Server: `POST /v1/devices/{device_id}/commands`
- Server: commands.status=queued
- Agent -> Server: `GET /v1/agent/commands/next` (DEVICE_TOKEN)
- Server: 하나 픽업 + running으로 전환
- Agent: 로컬 실행, 진행률 업로드
- Agent -> Server: `POST /v1/agent/reports` (command_id 포함)
- Server: reports 저장 + command succeeded 처리 + report_id 연결
- Web: `GET /v1/devices/{device_id}/commands` 폴링로 상태 표시
- Web: `GET /v1/reports/{report_id}`로 상세 확인

C) 오프라인 업로드 재시도
- Agent 업로드 실패 -> outbox에 payload 저장
- 다음 agent tick에서 outbox flush 시도

---

## 4) 보안 모델 (Security Model)

### 4.1 토큰 종류 및 수명
1) Enrollment Token (단기/1회)
- 생성: Web에서 사용자 인증 후 발급
- 사용처: Agent 등록(enroll) 한 번
- TTL: 기본 60분(5~1440분 범위)
- 저장: DB에는 hash만, used_at 기록
- 평문 토큰은 발급 응답에만 포함(서버 로그에 남기지 않음)

2) Device Token (장기/회수 가능)
- 생성: enroll 완료 시 발급 (1회 반환)
- 사용처: Agent API 인증(명령 수신/상태 업데이트/리포트 업로드)
- 만료: 기본 1년(운영 정책)
- 회수: device revoke 또는 token revoke
- 저장: DB에는 hash만

3) Web User Token (JWT/세션)
- Web에서 사용자의 리소스 접근 제어
- MVP에서는 X-User-Id 헤더 방식은 운영 불가, 반드시 v1에서 제거

### 4.2 인증/인가(Authorization)
- Web API: user_id 기반 리소스 소유권 검사
  - devices.user_id == requester.user_id
  - reports는 devices.user_id를 join으로 확인
- Agent API:
  - Authorization Bearer <DEVICE_TOKEN> -> device_id/user_id 확정
  - commands.device_id가 일치하는지 확인
  - reports.device_id가 일치하는지 확인

### 4.3 공격면 방어
- Command allowlist로 임의 shell command 금지
- Token은 DB에 hash 저장
- Token/민감정보는 로그에 기록 금지 (mask)
- Rate limit (v1 권장):
  - enroll token 발급 횟수 제한
  - agent endpoints QPS 제한
- Replay 방지:
  - command_id는 한번만 처리(processed store)
  - server도 상태 전이 검증(queued->running->done)

---

## 5) 데이터 프라이버시 정책 기술 구현 (Privacy-by-Default)

### 5.1 서버 업로드 정책 강제
- 서버는 디바이스별 설정(device_settings)을 가진다.
- 업로드 요청의 params(include_paths 등)가 true여도 서버 정책이 허용하지 않으면 무시한다.
- Agent는 sanitize를 수행하되, 최종 정책은 서버가 재검증한다.

### 5.2 업로드 레벨
- Level 0: 요약만 (paths/files 숨김)
- Level 1: 파일명만 (basename만)
- Level 2: 전체 경로

### 5.3 서버-side sanitize(권장)
- reports.raw_report_json 저장 전, 서버가 한 번 더 sanitize 적용
- 이유: 악성/변조된 agent가 정책을 무시하고 업로드할 가능성 방지

---

## 6) 도메인 모델 / DB 스키마 (Detailed)

### 6.1 users
- id (text, pk)
- email (unique)
- password_hash
- created_at

### 6.2 enroll_tokens
- id (text, pk)
- user_id (fk)
- token_hash (sha256)
- expires_at
- used_at (nullable)
- created_at

인덱스:
- token_hash unique
- user_id + created_at

### 6.3 devices
- id (text, pk)
- user_id (fk)
- name
- platform
- arch
- fingerprint_hash
- agent_version
- created_at
- last_seen_at
- revoked_at

인덱스:
- user_id + last_seen_at desc
- fingerprint_hash(선택)

### 6.4 device_tokens
- id (text, pk)
- device_id (fk)
- token_hash
- created_at
- expires_at
- revoked_at
- last_used_at

인덱스:
- token_hash unique
- device_id

### 6.5 commands
- id (text, pk)
- device_id (fk)
- user_id (fk)  (누가 발행했는지 감사 목적)
- type (text allowlist)
- params_json (jsonb)
- status (enum)
- progress (int 0-100)
- message (text)
- created_at
- started_at
- finished_at
- expires_at
- report_id (nullable)
- dedupe_key (nullable)

인덱스:
- (device_id, status, created_at)
- (user_id, created_at desc)

### 6.6 reports
- id (text, pk)
- device_id (fk)
- command_id (nullable fk)
- created_at
- 요약 컬럼:
  - health_score (int)
  - disk_free_percent (real)
  - startup_apps_count (int)
  - one_liner (text)
- json 컬럼:
  - slowdown_json
  - storage_json
  - privacy_json
  - cleanup_json
- raw_report_json (jsonb)

인덱스:
- (device_id, created_at desc)
- (command_id)

### 6.7 device_settings (v1 권장)
- device_id (pk/fk)
- upload_level (int: 0/1/2)
- allow_include_paths (bool)  (upload_level과 중복 가능, 정책 명확화 용)
- created_at
- updated_at

---

## 7) API 설계 상세 (Detailed API Spec)

표기 규칙:
- Web API: 사용자 인증 필요 (JWT/세션)
- Agent API: Authorization Bearer DEVICE_TOKEN
- Enrollment: Authorization Bearer ENROLL_TOKEN

### 7.1 Web API

1) Enrollment Token 발급
- Method: POST
- Path: /v1/tokens/enroll
- Query: ttl_minutes (optional, default 60)
- Response:
  - enroll_token (string, plain)
  - expires_at (iso)
  - ttl_minutes (int)

2) 디바이스 목록
- Method: GET
- Path: /v1/devices
- Response: devices[] with:
  - id, name, platform, arch, agent_version
  - last_seen_at
  - latest_score, latest_one_liner, latest_report_at

3) 디바이스 상세
- Method: GET
- Path: /v1/devices/{device_id}
- Response:
  - device
  - latest_report (nullable)

4) 원격 명령 생성
- Method: POST
- Path: /v1/devices/{device_id}/commands
- Body:
  - type (allowlist)
  - params (json)
- Response:
  - command_id
  - status=queued

params 예시:
- include_paths: bool
- include_file_names: bool
- show_process_names: bool
- deep: bool (type에 따라 내부적으로 결정 가능)

5) 명령 히스토리
- Method: GET
- Path: /v1/devices/{device_id}/commands?limit=50
- Response: commands[] with:
  - id, type, status, progress, message, created_at, started_at, finished_at, report_id

6) 리포트 상세
- Method: GET
- Path: /v1/reports/{report_id}
- Response:
  - id, device_id, created_at
  - summary
  - raw_report (MVP)
  - v1: raw_report는 upload_level에 따라 마스킹 적용

7) 디바이스 revoke
- Method: POST
- Path: /v1/devices/{device_id}/revoke
- Response: ok true

8) (v1) 디바이스 정책 설정
- Method: PUT
- Path: /v1/devices/{device_id}/settings
- Body:
  - upload_level: 0|1|2
- Response: settings

### 7.2 Agent API

1) 디바이스 등록(enroll)
- Method: POST
- Path: /v1/agent/enroll
- Auth: Bearer ENROLL_TOKEN
- Body:
  - device_name, platform, arch, agent_version, device_fingerprint
- Response:
  - device_id
  - device_token (plain, 1회)
  - expires_in

2) 다음 명령 수신
- Method: GET
- Path: /v1/agent/commands/next
- Auth: Bearer DEVICE_TOKEN
- Response:
  - command: null or { id, type, params, issued_at }
- Server behavior:
  - expired 처리
  - queued 중 1개를 running으로 전환 (transaction + FOR UPDATE SKIP LOCKED)

3) 명령 상태 업데이트
- Method: POST
- Path: /v1/agent/commands/{command_id}/status
- Body:
  - status, progress(0-100), message
- Server behavior:
  - command.device_id 검증
  - 상태 전이 검증(v1 권장)

4) 리포트 업로드
- Method: POST
- Path: /v1/agent/reports
- Body:
  - command_id (optional)
  - report (json)
- Server behavior:
  - 요약 추출
  - raw_report_json 저장(정책에 따라 마스킹)
  - command_id 있으면 commands.succeeded + report_id 연결

5) (v1 권장) Heartbeat
- Method: POST
- Path: /v1/agent/heartbeat
- Body:
  - agent_version
  - capabilities (optional)
- Server behavior:
  - devices.last_seen_at 갱신
  - 오래된 agent 경고/차단

---

## 8) Command 상태 전이 (State Machine)

상태:
- queued -> running -> succeeded/failed
- queued -> expired (TTL)
- queued/running -> canceled (웹에서 취소 기능 추가 시)

권장 서버 검증 규칙(v1):
- running으로 전환은 서버만 수행 (/commands/next)
- agent는 running 중 progress 업데이트만 가능
- succeeded/failed는 agent가 보고서 업로드 or status 업데이트로 완료
- expired는 서버가 처리 (폴링 시점 또는 cron)

중복 처리:
- 같은 command_id를 agent가 재실행하지 않도록 로컬 processed store
- 서버도 command.status가 done이면 재완료 요청을 무시하거나 idempotent 처리

---

## 9) Agent 내부 설계 (Detailed Agent Design)

### 9.1 커맨드 라우팅
- mapCommandToRunOptions(cmd.type, cmd.params)
- RUN_FULL: 기본 분석(스토리지/프라이버시/슬로우다운)
- RUN_DEEP: 중복 파일 추정 포함(시간/리소스 증가)
- RUN_STORAGE_ONLY: 폴더 용량 요약 중심
- RUN_PRIVACY_ONLY: 캐시/다운로드 흔적 요약 중심
- RUN_DOWNLOADS_TOP: Downloads 큰 파일 후보 생성
- PING: 최소한의 시스템 정보/버전 보고 (또는 storageOnly+privacyOnly 형태)

### 9.2 로컬 리포트 생성 파이프라인
- Folder Summary:
  - Downloads/Desktop/Documents/Pictures 등 기본 경로 스캔
  - bytes, fileCount
- Disk free percent:
  - OS별 디스크 사용량 추정 (가능한 한 정확하게)
- Startup items:
  - OS별 시작 프로그램 수 (best-effort)
- Process snapshot:
  - 기본은 이름 숨김, countHint/CPU heavy processes 요약만
- Privacy snapshot:
  - 브라우저 캐시 후보 경로의 용량 합
  - Download folder bytes/files
- Duplicates (deep):
  - 해시 기반 그룹화 (maxFiles 제한)
- Health score:
  - 규칙 기반 점수 + severity
- Slowdown reasons:
  - 룰 기반 원인 목록
- Recommendations:
  - actionable recommendations list
- Cleanup candidates:
  - downloadsTop (file-level candidates)
- Transparency:
  - 수집/미수집 항목 명시

### 9.3 sanitizeForUpload (필수)
- 기본: storage.path = hidden
- downloadsTop.path = hidden (또는 basename)
- privacy.browserCachePaths = []
- process names 숨김
- 정책은 서버가 최종 강제(v1)

### 9.4 outbox (업로드 실패 재시도)
- 업로드 실패 시 payload를 outbox에 파일로 저장
- 다음 tick에서 순서대로 재시도
- 재시도 실패 시 backoff(간단히 tick 간격 증가)

### 9.5 processed store (중복 실행 방지)
- command_id가 done에 있으면 실행 생략
- 서버에 succeeded(이미 처리됨) 업데이트(선택)
- processed store는 일정 기간 후 정리(예: 30일) 가능(v1)

### 9.6 에이전트 자동 실행 (v1)
- install-agent:
  - OS 감지 후 launchd/task/systemd 템플릿 설치
  - 업그레이드/언인스톨 지원
- agent service:
  - `pc-insight agent --interval 8000`
  - 로그는 로컬 파일 또는 OS 로그 시스템

---

## 10) Web 대시보드 설계 (Detailed Web Design)

### 10.1 페이지 구조
- /devices
  - 디바이스 카드: 최신 점수/한 문장/마지막 연결
  - 액션 버튼: RUN_FULL, RUN_DEEP, RUN_DOWNLOADS_TOP, RUN_PRIVACY_ONLY
  - "+ 새 PC 연결" 모달

- /devices/{id}
  - 상태 카드: last_seen, 현재 작업, progress/message
  - 최신 리포트 카드: 점수/한 문장/생성 시각/보기 링크
  - 커맨드 히스토리 테이블: status/progress/report link
  - (v1) 정책 설정: upload_level 토글
  - (v1) revoke 버튼

- /reports/{id}
  - 요약 + raw json (MVP)
  - (v1) 파일 후보 목록 UI + 체크리스트 연결

### 10.2 폴링 전략 (MVP)
- devices/{id} 페이지에서 2초 폴링
- commands/status 변경 반영
- 서버 부하 고려해 limit/조건부 폴링 적용(v1):
  - running/queued 있을 때만 2초
  - 없으면 10초

### 10.3 실시간 업그레이드(vNext)
- SSE 또는 WebSocket으로 command progress push
- 서버: command status 변경 이벤트 스트림
- 웹: 구독/해제 로직

---

## 11) 서버 구현 상세 (Backend Implementation Details)

### 11.1 DB 접근 계층
- asyncpg pool
- 트랜잭션 사용:
  - /agent/commands/next: SKIP LOCKED + status update atomic
- 입력 검증:
  - Pydantic 모델로 request/response 구조
- 에러 처리:
  - 4xx: user error
  - 5xx: server error
- id 생성:
  - prefix + uuid hex

### 11.2 명령 픽업 경쟁 조건 처리
- 동일 device에 대해 여러 agent 인스턴스 실행 가능성
- 해결:
  - SELECT ... FOR UPDATE SKIP LOCKED
  - 트랜잭션 내에서 queued -> running 전환
  - agent 단에서 단일 실행 권장(설치 스크립트에서 중복 방지)

### 11.3 서버-side sanitize (v1 권장)
- device_settings.upload_level 확인
- raw_report_json 저장 전 sanitize 적용
- 요약 컬럼 추출은 sanitize된 데이터를 기반으로 수행

### 11.4 TTL/Expired 처리
- /agent/commands/next 호출 시:
  - expires_at <= now() 인 queued command를 expired로 전환
- (v1) cron worker:
  - 주기적으로 오래된 queued/running 처리(예: running timeout)

### 11.5 Running timeout (v1)
- running 상태가 너무 오래 지속(예: 30분)하면 failed/expired 처리
- 단, deep 모드는 예외 시간 부여 가능

---

## 12) 성능/리소스 제약 (Performance & Limits)

### 12.1 Agent 제한
- deep duplicate 분석:
  - maxFiles (예: 12000)
  - minBytes (예: 80KB)
  - extensions 제한
- 큰 폴더 스캔:
  - depth 제한(선택)
  - early abort 가능(선택)

### 12.2 서버 제한
- 업로드 payload 크기 제한:
  - raw_report_json은 최대 크기 제한 필요(예: 2~5MB)
  - 너무 크면 raw_report 저장 생략 or 축약
- Rate limiting:
  - agent reports: device당 분당 N회 제한
  - web commands: 사용자당 분당 N회 제한

---

## 13) 관측성(Observability) & 운영 (Ops)

### 13.1 서버 모니터링 지표
- commands issued/succeeded/failed/expired
- 평균/95p 실행 시간 (command 생성 -> report 저장)
- 업로드 실패율
- API latency
- DB connection pool 사용량

### 13.2 로깅
- 웹 요청 로그: user_id, path, status, latency (PII 최소)
- 에이전트 요청 로그: device_id, endpoint, status
- 민감 정보 마스킹:
  - enroll_token/device_token 절대 로그 금지

### 13.3 에러 리포팅
- 서버: Sentry
- 에이전트: 선택적으로 Sentry(옵트인)

---

## 14) 배포/환경 변수 (Deployment & Config)

### 14.1 Backend env
- DATABASE_URL
- JWT_SECRET (v1)
- CORS_ORIGINS
- LOG_LEVEL
- SENTRY_DSN (optional)

### 14.2 Web env
- NEXT_PUBLIC_API_BASE
- (MVP 임시) NEXT_PUBLIC_USER_ID
- (v1) auth callback URLs, OAuth client IDs

### 14.3 Agent config
- serverUrl
- deviceId
- deviceToken
- intervalMs (기본 8000)

---

## 15) 테스트 전략 (Testing Strategy)

### 15.1 단위 테스트
- sanitizeForUpload:
  - Level 0/1/2 정책에 따른 출력 검증
- command routing:
  - cmd type -> opts mapping
- health scoring:
  - 입력(디스크/메모리/스타트업) -> score/severity

### 15.2 통합 테스트
- enroll_token 발급 -> agent enroll -> device_token 발급
- command create -> agent next -> report upload -> command succeed -> web 조회
- outbox:
  - 업로드 실패를 시뮬레이션 -> outbox 저장 -> 재시도 성공 확인

### 15.3 보안 테스트
- 토큰 평문 DB 저장 여부 점검
- allowlist 외 type 차단
- 다른 user가 device/report 접근 불가 확인

---

## 16) 마이그레이션/호환성 (Compatibility)

### 16.1 Agent 버전 정책
- devices.agent_version 저장
- 서버 최소 지원 버전(min_agent_version) 정의(v1)
- 오래된 agent는:
  - commands/next 응답에서 경고 포함 또는 명령 제한

### 16.2 Report schema versioning
- report 내부에 `schemaVersion` 필드 추가 권장(v1)
- 서버는 구버전도 수용하되 요약 추출 실패 시 graceful degrade

---

## 17) 구현 우선순위 (Implementation Plan)

### Phase 0 (이미 있음)
- command queue + polling + report upload + 기본 대시보드

### Phase 1 (운영 필수)
1) Web auth (JWT/세션) 도입, X-User-Id 제거
2) device revoke UI + API 완성
3) device_settings(upload_level) 도입 + 서버-side sanitize
4) agent 자동 실행 설치 (launchd/task/systemd)
5) 모니터링/로그 마스킹 정비

### Phase 2 (제품 퀄리티)
- 리포트 UI 정리(표/카드), 체크리스트 UI 완성
- retry/cancel, running timeout, heartbeat
- SSE/WebSocket 진행률

---

## 18) 오픈 이슈 / 결론

필수 결론:
- "운영"을 위해서는 Agent 자동 실행 + Web Auth + 정책 강제가 필수
- 프라이버시 신뢰 확보를 위해 서버-side sanitize가 권장
- 원격 명령은 allowlist로만 유지(임의 실행 금지)

오픈 이슈:
- 로그인 방식 선택(GitHub OAuth vs Email)
- raw report 저장 정책(기본 저장 vs 옵트인)
- deep 분석 제한치(maxFiles 등) 튜닝

---
