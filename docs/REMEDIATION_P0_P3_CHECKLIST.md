# P0~P3 Remediation Checklist

Last updated: 2026-02-14

Related:
- AI 적용 실행 계획: `docs/AI_COPILOT_P0_P3_PLAN.md`
- CLI/Web 보안 감사: `docs/CLI_WEB_SECURITY_AUDIT_2026-02-14.md`
- PC 설치/연결 온보딩 계획: `docs/PC_ONBOARDING_INSTALL_PLAN.md`

## Scope
- Objective: Fix prioritized issues (P0, P1, P2, P3) found in code-level review.
- Rule: Each item is updated from `[ ]` to `[x]` immediately after code + verification are complete.

## P0 (Critical)
- [x] P0-1 Remove insecure JWT secret default risk and enforce secure runtime validation
- [x] P0-2 Fix enrollment token race condition (atomic single-use guarantee)
- [x] P0-3 Fix command dequeue race condition (single-consumer guarantee)
- [x] P0-4 Apply endpoint rate limiting for auth/token/share APIs
- [x] P0-5 Enforce agent report payload size guard (`max_report_size_bytes`)
- [x] P0-6 Migrate web auth session from `sessionStorage` to HttpOnly cookie flow

## P1 (High)
- [x] P1-1 Add startup/shutdown DB lifecycle handling and health DB check
- [x] P1-2 Fix Agent command API contract mismatch (`params`, `issued_at`)
- [x] P1-3 Make analyzer profile selection effective (not always full scan)
- [x] P1-4 Stop leaking internal DB exception details in report API
- [x] P1-5 Improve web token storage strategy (remove `localStorage` usage)
- [x] P1-6 Sync home auth navigation state after login/logout (prevent stale `대시보드` link)
- [x] P1-7 Strengthen auth input validation (email format, password min length)
- [x] P1-8 Add report share management (list/revoke) and harden share token entropy
- [x] P1-9 Add baseline web security headers

## P2 (Medium)
- [x] P2-1 Restore web lint pipeline (non-interactive ESLint config)
- [x] P2-2 Restore agent lint pipeline (ESLint config)
- [x] P2-3 Add 401 auto-session-clear handling on web API client
- [x] P2-4 Implement refresh token rotation flow (`/v1/auth/refresh`) and cookie-based session renewal
- [x] P2-5 Add distributed rate-limit backend (Redis optional + memory fallback)

## P3 (Low)
- [x] P3-1 Fix UI bug where `0%` disk free is rendered as `-`
- [x] P3-2 Fix report summary card grid responsiveness (`/reports/[id]`)
- [x] P3-3 Add AI provider selector (`OPENAI` / `GLM4.5`) on device detail
- [x] P3-4 Set default AI provider to `GLM4.5` and apply runtime env (`GLM_*`)
- [x] P3-5 Clean legacy AI version display (`model=default` hidden from usage list)
- [x] P3-6 Home `시작하기` button handles logged-in state with logout-confirm popup
- [x] P3-7 Show current logged-in user email on dashboard header

## Verification Log
- [x] Run server tests
- [x] Run web tests/build/lint
- [x] Run agent tests/typecheck/lint
- [x] Run server e2e tests
- [x] Run runtime smoke (server -> web -> agent API chain)
- [x] Run AI completion smoke (ping latency trend + versions API + PDF export)
- [x] Run real AI integration smoke (GLM direct API + server `ai-summary` non-mock path)

Notes:
- `server` test result: `22 passed` (`pytest -q`)
- `server e2e` result: `3 passed` (`pytest -q tests/e2e`)
- `web` result: `npm run lint`, `npm run build` passed
- `agent` result: `npm run lint`, `npm run typecheck`, `npm run test -- --run` passed
- `real AI` result (2026-02-14): GLM direct `/chat/completions` returned `200`, server default provider(`glm45`) `ai-summary` returned `source=llm`, and `provider=openai` returned expected key-missing fallback.
- `auth me` result (2026-02-14): `/v1/auth/me` returned authenticated user `{id, email}` and dashboard email rendering wired.
- `security hardening smoke` (2026-02-14): cookie login -> `/auth/me` via cookie 200, enroll via cookie 200, share create/list/revoke/public-expire(410), logout 후 `/auth/me` 401 확인.
- `rate-limit smoke` (2026-02-14): 동일 IP에서 로그인 12회 시도 시 `401 x10` 이후 `429` 전환 확인.
- `refresh smoke` (2026-02-14): login -> `/auth/me` 200 -> `/auth/refresh` 200(access_token 재발급) -> `/auth/me` 200 확인.

## AI Copilot P0~P3 Completion
- [x] P0 complete
- [x] P1 complete
- [x] P2 complete
- [x] P3 complete

## 2026-02-14 Additional Hardening/Onboarding
- [x] A-1 CLI HTTPS 기본값/검증 강화 (`link` 기본 `https`, non-localhost HTTP 차단)
- [x] A-2 CLI 로컬 토큰 파일 권한 강화 (`~/.pc-insight` 700 / `config.json` 600)
- [x] A-3 Cookie-auth CSRF 보호 적용(Origin/Referer + `X-PCInsight-CSRF`)
- [x] A-4 Agent API 레이트리밋 적용(enroll/next/status/report/heartbeat)
- [x] A-5 레이트리밋 XFF 신뢰 조건화(`TRUST_PROXY_HEADERS`)
- [x] A-6 Command API pagination 상한 적용(`limit <= 100`)
- [x] A-7 Web CSP 헤더 적용
- [x] A-8 Web auth header-token 저장 제거(cookie-session 중심)
- [x] A-9 Share token 해시 저장 전환(+legacy 호환)
- [x] A-10 운영 하드닝 옵션(TrustedHost + docs 토글) 적용
- [x] B-1 Web PC 연결 모달 고도화(OS 선택/원커맨드/스크립트 다운로드/연결확인)
- [x] B-2 Enroll token 상태 확인 API 추가(`/v1/tokens/enroll/status`)

## Additional Verification (2026-02-14)
- [x] `server`: `pytest -q` (24 passed)
- [x] `server`: `pytest -q tests/e2e` (3 passed, 랜덤 포트 기반 안정화)
- [x] `web`: `npm run lint` / `npm run build` / `npm test -- --runInBand`
- [x] `agent`: `npm run lint` / `npm run typecheck` / `npm run test -- --run`
- [x] `fail-fast smoke`: invalid `DATABASE_URL`로 기동 시 startup 단계에서 즉시 종료 확인
- [x] `manual UI smoke`: 서버 중지 상태에서 `/login` 요청 시 우측 상단 팝업(`서버 연결 문제`) 노출 확인

## 2026-02-14 MVP Functional Re-Review (Security Out-of-Scope)
- [x] F-P0-1 DB init migration order fix (`report_shares` create before alter)
- [x] F-P0-2 DB init fail-fast 적용 (초기화 실패 시 서버 즉시 종료)
- [x] F-P1-1 Web onboarding API 기본 포트 정합화 (`8000`)
- [x] F-P1-2 인증 상태 동기화 개선 (`useRequireAuth` event/focus sync)
- [x] F-P1-3 CLI enroll 비멱등 요청 재시도 제거
- [x] F-P2-1 CLI agent polling interval 검증(1000~60000ms)
- [x] F-P3-1 회원가입 후 로그인 성공 안내 메시지 표시
- [x] F-P3-2 AB variant effect 재실행 최소화
- [x] F-P3-3 API 다운/초기화 실패 시 웹 팝업 알림(`pcinsight-api-unreachable`)
