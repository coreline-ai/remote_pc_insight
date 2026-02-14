# Security Remediation Execution Plan (2026-02-14)

## 목표
- 보안 취약 우선순위(P0~P3)를 코드/테스트 기준으로 실제 수정
- 각 항목은 `코드 수정 + 자체 테스트 통과` 시에만 완료 처리

## 진행 규칙
- 체크박스 상태:
  - `[ ]` 미완료
  - `[x]` 완료 (검증 완료)
- 항목별로 테스트 명령과 결과를 기록

## P0 (즉시 조치)
- [x] P0-1 테스트 계정 기본 노출/자동 시드 제거
  - 범위: `server/app/core/config.py`, `server/app/core/bootstrap.py`, `web/app/login/page.tsx`
  - 완료 기준:
    - 기본 설정에서 테스트 계정/비밀번호가 자동 활성화되지 않음
    - 로그인 폼 기본값에 고정 계정/비밀번호가 보이지 않음
  - 테스트:
    - `pytest server/tests/api -q`
    - `cd web && npm test -- --runInBand`

- [x] P0-2 운영 보안 가드 강화 (production/staging)
  - 범위: `server/app/core/config.py`
  - 완료 기준:
    - production/staging에서 insecure JWT, insecure cookie, API docs on, MVP test login on 을 차단
  - 테스트:
    - `pytest server/tests/api -q`

- [x] P0-3 취약 의존성 패치 (Next.js / eslint-config-next)
  - 범위: `web/package.json`, `web/package-lock.json`
  - 완료 기준:
    - `npm audit` critical/high 이 0 또는 대응 가능한 수준으로 감소
  - 테스트:
    - `cd web && npm audit --package-lock-only`
    - `cd web && npm run build`

## P1 (고우선)
- [x] P1-1 명령/리포트 조회 API 레이트리밋 확장
  - 범위: `server/app/api/v1/routers/commands.py`, `server/app/api/v1/routers/reports.py`
  - 완료 기준:
    - create/list/get command, report read/export/share-list 요청에 제한 적용
  - 테스트:
    - `pytest server/tests/api -q`

- [x] P1-2 AI 버전/메트릭 사용자 범위 분리
  - 범위: `server/app/api/v1/routers/ai.py`, `server/app/services/ai_guardrails.py`, `server/app/services/ai_runtime.py`
  - 완료 기준:
    - `/v1/ai/versions` 집계가 현재 사용자 기준으로 조회됨
    - `/v1/ai/metrics`가 전역 누적 노출을 피하고 사용자 스코프 기준으로 제공됨
  - 테스트:
    - `pytest server/tests/api/test_ai_versions.py -q`
    - `pytest server/tests/api/test_ai_runtime.py -q`

- [x] P1-3 CSRF 토큰을 고정값 대신 쿠키-헤더 매칭으로 강화
  - 범위: `server/app/api/v1/deps.py`, `server/app/api/v1/routers/auth.py`, `web/lib/api.ts`, `server/app/core/config.py`
  - 완료 기준:
    - refresh/logout 등 cookie-auth 상태변경 요청이 쿠키 기반 CSRF 토큰 매칭을 요구
  - 테스트:
    - `pytest server/tests/e2e/test_auth_refresh_flow.py -q` (가능 시)
    - `cd web && npm test -- --runInBand`

## P2 (중요)
- [x] P2-1 outbox 파일 권한 최소화(0600/0700)
  - 범위: `agent/src/core/store/outbox.ts`
  - 완료 기준:
    - 생성되는 outbox 파일/디렉토리 권한 강화
  - 테스트:
    - `cd agent && npm test -- --runInBand`

- [x] P2-2 health 응답 정보 최소화(운영 노출 축소)
  - 범위: `server/app/main.py`
  - 완료 기준:
    - 운영 환경에서 DB 세부 상태 노출 최소화
  - 테스트:
    - `pytest server/tests/api/test_health.py -q`

## P3 (개선)
- [x] P3-1 보안 변경사항 문서/README 동기화
  - 범위: `README.md`, `docs/REMEDIATION_P0_P3_CHECKLIST.md`
  - 완료 기준:
    - 변경된 보안 동작/환경변수/운영 주의사항 반영

---

## 실행 로그
- [x] 시작: 2026-02-14 보안 리메디에이션 작업 착수
- [x] 완료: 모든 체크박스 완료 및 자체 테스트 통과

## 자체 테스트 결과
- [x] `cd server && pytest tests/api -q` → `29 passed`
- [x] `cd server && pytest tests/e2e/test_auth_refresh_flow.py tests/e2e/test_ai_copilot_flow.py -q` → `2 passed`
- [x] `cd web && npm test -- --runInBand` → `4 suites / 19 tests passed`
- [x] `cd web && npm run build` → `Next.js 15.5.10 build success`
- [x] `cd web && npm audit --package-lock-only --audit-level=moderate` → `0 vulnerabilities`
- [x] `cd agent && npm test` → `2 files / 7 tests passed`
- [x] `cd agent && npm run typecheck` → `success`
