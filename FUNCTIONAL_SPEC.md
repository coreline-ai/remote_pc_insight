# FUNCTIONAL_SPEC.md — pc-insight Cloud 기능 명세서
Version: 1.0
Date: 2026-02-03
Owner: Hwan Choi
Scope: MVP → v1 개발 착수 가능 수준

---

## 0) 코드블럭 깨짐 방지 규칙
- 본 문서는 단일 md 코드블럭 안에서만 제공됨
- 내부에 추가 fenced code block(백틱 3개) 금지
- 코드/명령/JSON은 인라인 코드 또는 4칸 들여쓰기로만 표기

---

## 1) 문서 목적
이 문서는 개발자가 **md 문서만 보고도 구현**할 수 있도록,
- 사용자 기능(웹/CLI)
- 서버 기능(백엔드)
- 데이터/정책/상태 전이
- 에러/경계조건
을 “구현 가능한 수준”으로 명세한다.

---

## 2) 용어 정의
- User: 웹에 로그인하는 사용자
- Device: 사용자의 PC(노트북/데스크탑)
- Agent: PC에서 실행되는 CLI 프로세스
- Enrollment Token: 디바이스 등록용 1회성 단기 토큰
- Device Token: 에이전트 인증용 장기 토큰(회수 가능)
- Command: 원격 실행 요청(큐 기반)
- Report: 점검 결과 JSON (요약 + raw)
- Upload Level: 서버가 강제하는 업로드 정책(0/1/2)
- Checklist: 리포트에서 생성되는 정리 할 일 목록

---

## 3) 제품 기능 구성 (Feature Map)

A. 계정/인증
- A1 웹 로그인(JWT/세션)
- A2 사용자 리소스 접근 제어

B. 디바이스 등록/관리
- B1 enroll token 발급
- B2 link로 디바이스 등록(enroll)
- B3 디바이스 목록/상세 조회
- B4 디바이스 revoke(회수)
- B5 (v1) 디바이스 설정(upload level)

C. 원격 명령(커맨드 큐)
- C1 웹에서 명령 생성
- C2 에이전트 폴링으로 픽업
- C3 실행 중 진행률 업데이트
- C4 완료/실패/만료 처리
- C5 (v1) 취소/재시도

D. 리포트
- D1 로컬 분석 후 리포트 생성
- D2 업로드 정책에 따라 마스킹
- D3 서버 저장(요약 컬럼 추출)
- D4 웹 조회(요약/상세)

E. 체크리스트 UX
- E1 리포트 항목 클릭 → 체크리스트 생성
- E2 파일 단위 항목 추가
- E3 체크리스트 진행률/완료

F. 운영 필수(Production)
- F1 에이전트 자동 실행(로그인 시)
- F2 로그/모니터링
- F3 버전 호환/업데이트 가이드
- F4 보존/삭제 정책

---

## 4) 사용자 기능 명세 (Web UX)

### 4.1 /devices (디바이스 목록)
목표:
- 여러 대 PC 상태를 한눈에 보여주고, 원격 점검을 1클릭으로 실행

화면 요소:
- 디바이스 카드 리스트
  - 이름, OS/arch, agent_version
  - last_seen_at
  - latest_score
  - latest_one_liner
  - latest_report_at
- 버튼:
  - + 새 PC 연결 (모달)
  - 새로고침
- 디바이스 카드 액션:
  - 지금 점검(RUN_FULL)
  - Deep(RUN_DEEP)
  - Downloads 후보(RUN_DOWNLOADS_TOP)
  - 프라이버시(RUN_PRIVACY_ONLY)

동작:
- 페이지 진입 시 devices fetch
- 버튼 클릭 시 command 생성 -> 즉시 토스트/표시(queued)
- 상세 페이지로 이동 가능

예외:
- revoked device는 기본 숨김(또는 "revoked" 섹션 분리)

---

### 4.2 “새 PC 연결” 모달
목표:
- 초보도 30초 내 연결 완료

동작:
1) 모달 오픈 시 enroll token 자동 발급
2) 복사 가능한 단일 명령어 제공:
   - `pc-insight link <ENROLL_TOKEN> --server <API_BASE>`
3) 토큰 만료 시각 표시 + 재발급 버튼
4) 에이전트 실행 안내:
   - `pc-insight agent`
   - (v1) 자동 실행 설치 안내 링크

예외:
- 토큰 발급 실패 시 에러 표시 및 재시도 제공

---

### 4.3 /devices/{device_id} (디바이스 상세)
목표:
- 현재 작업 진행률 확인 + 최근 리포트 + 히스토리

화면 요소:
- 상태 카드:
  - last_seen_at
  - 현재 queued/running 명령 1개 요약
  - 진행률(%) + message
- 최신 리포트 카드:
  - score, one_liner, created_at
  - 리포트 보기 링크
- 커맨드 히스토리 테이블:
  - created_at, type, status, progress, message, report 링크
- (v1) 디바이스 설정:
  - upload_level 선택(0/1/2)
- (v1) revoke 버튼

동작:
- 폴링(2초): commands list 갱신
- running/queued가 없으면 폴링 간격을 늘려 서버 부담 감소(v1)

예외:
- queued가 오래 지속되면 "오프라인일 수 있음" 안내 표시

---

### 4.4 /reports/{report_id} (리포트 상세)
목표:
- 리포트의 핵심 결과를 이해하고, 정리 체크리스트로 전환

MVP UI:
- 요약 카드(score/one_liner/created_at)
- raw JSON 뷰어

v1 UI:
- 섹션 분리:
  - Slowdown / Storage / Privacy / Cleanup
- Cleanup > Downloads 후보 리스트:
  - 항목별 "+ 체크리스트 추가" 버튼
- 업로드 레벨 정책 반영:
  - Level 0: 경로 숨김
  - Level 1: 파일명만 표시
  - Level 2: 전체 경로 표시

---

### 4.5 체크리스트(기능)
MVP:
- 체크리스트는 우선 서버 저장 없이 “리포트에서 생성되는 UI 상태”로도 시작 가능
v1:
- checklist 테이블 추가하여 영속화 권장

체크리스트 항목 구조(권장):
- id, device_id, report_id
- title
- severity (low/med/high)
- file_ref (nullable: file_name/path_hash)
- done boolean
- created_at

---

## 5) 서버 기능 명세 (Backend)

### 5.1 인증/인가
필수:
- 웹 API는 로그인 기반 인증(JWT/세션) 필수
- 리소스 소유권 검증:
  - devices.user_id == requester.user_id
  - reports는 devices join으로 검증
  - commands도 동일

에이전트 인증:
- DEVICE_TOKEN hash 검증으로 device_id 확정
- revoked device/tokens는 거부

---

### 5.2 Enrollment Token 발급
요건:
- 사용자 인증된 상태에서 발급
- TTL 설정(기본 60분)
- DB에는 token_hash만 저장
- 평문은 응답에만 포함
- 재발급 가능(이전 토큰은 유효, TTL로 만료)

---

### 5.3 Agent Enroll
요건:
- ENROLL_TOKEN 검증(만료/사용됨 체크)
- devices row 생성 또는 기존 fingerprint 매칭(정책 선택)
- device_token 생성 후 1회 반환
- enroll_tokens.used_at 기록
- devices.last_seen_at 갱신

---

### 5.4 Command Queue
요건:
- Web에서 create command:
  - device revoke면 거부
  - allowlist type만 허용
  - params는 schema 검증
  - expires_at 설정(기본 15분)
- Agent polling:
  - queued 중 1개를 트랜잭션으로 가져오기
  - queued -> running 전환
  - started_at 설정
- Status update:
  - progress/message 업데이트
- 완료:
  - report 업로드 시 succeeded 처리 + report_id 연결
- 만료:
  - expires_at 지나면 expired 처리

권장:
- running timeout(예: FULL 10분, DEEP 60분)

---

### 5.5 Report 저장/요약 추출
요건:
- report payload 저장 전, 서버 정책(upload_level)에 따라 마스킹(권장)
- 요약 컬럼 추출:
  - health_score
  - disk_free_percent
  - startup_apps_count
  - one_liner
- raw_report_json 저장
- payload 크기 제한(예: 5MB)

---

### 5.6 Device Settings (v1)
요건:
- upload_level: 0/1/2
- 서버는 upload_level을 강제
- report 저장 시 server-side sanitize 적용

---

### 5.7 Device Revoke
요건:
- devices.revoked_at set
- device_tokens.revoked_at set
- 이후 agent 접근 거부
- web에서 “revoked” 표시

---

## 6) Agent 기능 명세 (CLI)

### 6.1 CLI Commands
필수:
- `pc-insight link <ENROLL_TOKEN> --server <URL>`
  - enroll 호출 -> device_id + device_token 저장
- `pc-insight agent [--interval ms]`
  - commands/next 폴링 -> 실행 -> report 업로드
- `pc-insight run <profile>`
  - 로컬 수동 실행(선택, 디버그 편의)
- (v1) `pc-insight install-agent`
- (v1) `pc-insight uninstall-agent`
- (선택) `pc-insight outbox` (재시도 큐 상태 확인)

---

### 6.2 실행 프로파일(명령 타입 -> 로컬 파이프라인)
- RUN_FULL:
  - storage summary + slowdown signals + privacy summary + recommendations + downloads top(상위 제한)
- RUN_DEEP:
  - RUN_FULL + duplicates 추정(시간 증가)
- RUN_STORAGE_ONLY:
  - storage 중심
- RUN_PRIVACY_ONLY:
  - privacy 중심
- RUN_DOWNLOADS_TOP:
  - downloads 후보 중심
- PING:
  - 최소 정보 + heartbeat (또는 storageOnly 최소)

---

### 6.3 로컬 데이터 저장
- config.json:
  - serverUrl
  - deviceId
  - deviceToken
  - lastLinkedAt
- outbox:
  - 업로드 실패 payload 파일들
- processed:
  - 최근 처리 command_id 목록
  - 일정 기간 후 청소 가능

---

### 6.4 안정성 요구사항
- 업로드 실패 시 outbox 저장 후 재시도
- 동일 command_id 재실행 방지
- 예외 발생 시 failed status 업데이트 시도

---

### 6.5 프라이버시/마스킹(에이전트 측)
- 기본: 경로 숨김(Level 0)
- include_paths 옵션이 있어도 서버 정책이 우선
- 경로는 path_hash로 대체 가능(중복 추정/집계 용)

---

## 7) 상태/정책/경계조건 명세

### 7.1 오프라인
- command가 queued로 오래 유지될 수 있음
- 웹은 last_seen_at 기반으로 오프라인 안내
- TTL 이후 expired 처리

### 7.2 중복 실행
- 에이전트 중복 실행 가능성:
  - 자동 실행 설치 시 중복 방지 필요
- processed store로 command_id 중복 실행 방지

### 7.3 보안
- allowlist 외 command 거부
- token 로그 금지
- payload 제한으로 DoS 방어

---

## 8) 기능별 완료 기준(Definition of Done)

### 8.1 Enrollment
- 웹에서 토큰 발급 가능
- PC에서 link 성공 후 /devices에 디바이스 노출
- device token이 평문으로 DB 저장되지 않음

### 8.2 Remote Command
- 웹에서 RUN_FULL 실행
- agent가 polling으로 수신 후 실행
- 진행률이 2초 폴링으로 반영
- report 저장 후 command succeeded 처리

### 8.3 Privacy Policy
- Level 0에서 경로가 절대 노출되지 않음
- 서버가 policy 강제(악성 agent 방어)

### 8.4 Revoke
- revoke 즉시 agent API 접근 거부
- 기존 토큰 재사용 불가

---

## 9) 기능 요구사항 기반 테스트 항목(요약)
- enroll token 만료/사용됨 케이스
- revoke 후 명령/업로드 거부
- command TTL 만료 처리
- outbox 재시도
- upload_level에 따른 마스킹
- allowlist 외 command 차단

---

## 10) 연관 문서
- PRD.md
- TRD.md
- DB_SCHEMA.md
- API_SPEC.md
- ARCHITECTURE.md
- INSTALL_AGENT.md
- SECURITY.md
- PRIVACY.md
- RUNBOOK.md
- TROUBLESHOOTING.md

---

# 추가 개발 문서(필수) — 아래 파일들도 제공되어야 “md만으로 개발 가능”해짐

- PROJECT_STRUCTURE.md: 레포 구조/모듈 책임 분리
- WORKFLOWS.md: 개발/테스트/배포 시나리오(명령 목록)
- BACKLOG.md: MVP 기능 티켓화(우선순위)
- ACCEPTANCE_TESTS.md: 인수 테스트 시나리오(사용자 관점)
- ERROR_CODES.md: 에러 코드 표준(클라이언트 UX 일관성)
- CONFIGURATION.md: 환경변수/설정 파일 규격(웹/서버/에이전트)

아래부터는 위 “추가 개발 문서”들을 각각 파일로 제공한다.

--------------------------------------------------------------------------------
# PROJECT_STRUCTURE.md
--------------------------------------------------------------------------------

# PROJECT_STRUCTURE.md — Repository Layout & Responsibilities

## 목표
- Agent/Server/Web을 한 레포에서 개발 가능
- 각 모듈 책임이 명확
- 문서/마이그레이션/운영 파일 포함

## 권장 트리
- /agent
  - src
  - package.json
  - README.md (agent 전용)
- /server
  - app
  - migrations
  - pyproject.toml
  - README.md (server 전용)
- /web
  - app
  - components
  - lib
  - package.json
  - README.md (web 전용)
- /docs
  - PRD.md
  - TRD.md
  - API_SPEC.md
  - DB_SCHEMA.md
  - FUNCTIONAL_SPEC.md
  - PRIVACY.md
  - SECURITY.md
  - INSTALL_AGENT.md
  - RUNBOOK.md
  - TROUBLESHOOTING.md
  - WORKFLOWS.md
  - CONFIGURATION.md
  - ERROR_CODES.md
  - ACCEPTANCE_TESTS.md
  - BACKLOG.md
- /ops
  - launchd (macOS plist 템플릿)
  - systemd (linux unit 템플릿)
  - windows (task scheduler 템플릿)
  - docker (compose, deployment)

---

## 각 모듈 책임

### agent
- link/enroll
- command polling
- local analyze pipelines
- sanitize + outbox + processed store
- auto-run installer(v1)

### server
- auth
- enroll token 발급
- agent enroll + device token 발급
- command queue + status
- report 저장 + 정책 강제
- device revoke/settings

### web
- devices dashboard
- connect modal
- command history/progress
- report viewer
- settings/revoke UI

---

--------------------------------------------------------------------------------
# WORKFLOWS.md
--------------------------------------------------------------------------------

# WORKFLOWS.md — Dev/Test/Deploy Workflows

## 로컬 개발 워크플로우

1) DB 준비
- Postgres 실행
- DATABASE_URL 설정

2) 서버 실행
- `uvicorn app.main:app --reload --port 8000`

3) 웹 실행
- `NEXT_PUBLIC_API_BASE=http://localhost:8000`
- `npm run dev`

4) 연결 테스트
- 웹에서 enroll token 발급
- PC에서 `pc-insight link ...`
- `pc-insight agent`

5) 명령 실행
- 웹에서 RUN_FULL 클릭
- /devices/{id}에서 진행률 확인
- 리포트 생성 확인

---

## CI 워크플로우(권장)
- agent: lint, typecheck, unit tests
- server: lint, unit tests, migration check
- web: lint, typecheck

---

## 배포 워크플로우(권장)
- server: Docker 이미지 빌드/배포
- web: static/SSR 배포
- DB: migration 적용
- 모니터링: Sentry 설정

---

--------------------------------------------------------------------------------
# BACKLOG.md
--------------------------------------------------------------------------------

# BACKLOG.md — MVP → v1 Task List (Prioritized)

## P0 (운영 필수)
- Web auth(JWT/OAuth) 도입, X-User-Id 제거
- device revoke UI + API
- device_settings(upload_level) + server-side sanitize
- agent auto-start installers(3 OS)
- logging masking + error reporting

## P1 (제품 완성도)
- checklist 영속화(테이블)
- retry/cancel 버튼
- running timeout 처리
- heartbeat API + last_seen 갱신 강화

## P2 (확장)
- SSE/WebSocket 진행률
- report history charts
- org/roles

---

--------------------------------------------------------------------------------
# ACCEPTANCE_TESTS.md
--------------------------------------------------------------------------------

# ACCEPTANCE_TESTS.md — User Acceptance Scenarios

## AT-1 새 PC 연결
- Given: 로그인 완료
- When: “새 PC 연결” 모달에서 명령어 실행
- Then: /devices 목록에 디바이스가 보인다

## AT-2 원격 점검 실행
- Given: agent 실행 중
- When: RUN_FULL 클릭
- Then: 진행률이 업데이트되고 리포트가 생성된다

## AT-3 오프라인 처리
- Given: agent 종료
- When: RUN_FULL 클릭
- Then: queued 유지 및 안내 표시, TTL 후 expired

## AT-4 프라이버시 레벨
- Given: upload_level=0
- When: 리포트 조회
- Then: 경로가 노출되지 않는다

## AT-5 revoke
- Given: 디바이스 revoke
- When: agent가 commands/next 호출
- Then: 401/403으로 차단된다

---

--------------------------------------------------------------------------------
# ERROR_CODES.md
--------------------------------------------------------------------------------

# ERROR_CODES.md — Error Code Standard

## 원칙
- 서버는 일관된 error.code를 반환
- 웹/에이전트는 code 기반으로 UX 메시지 표준화

## Codes
- AUTH_REQUIRED: 인증 필요
- AUTH_INVALID: 인증 실패
- TOKEN_EXPIRED: 토큰 만료
- TOKEN_USED: 이미 사용됨
- DEVICE_REVOKED: 디바이스 회수됨
- COMMAND_NOT_ALLOWED: 허용되지 않은 명령
- NOT_FOUND: 리소스 없음
- RATE_LIMITED: 호출 제한
- PAYLOAD_TOO_LARGE: 업로드 크기 제한
- INTERNAL_ERROR: 서버 오류

---

--------------------------------------------------------------------------------
# CONFIGURATION.md
--------------------------------------------------------------------------------

# CONFIGURATION.md — Configuration & Environment Variables

## Server env
- DATABASE_URL
- JWT_SECRET (v1)
- CORS_ORIGINS
- LOG_LEVEL
- SENTRY_DSN (optional)

## Web env
- NEXT_PUBLIC_API_BASE
- (v1) OAuth client IDs / callback URLs

## Agent config.json
- serverUrl
- deviceId
- deviceToken
- intervalMs
- lastLinkedAt

---

