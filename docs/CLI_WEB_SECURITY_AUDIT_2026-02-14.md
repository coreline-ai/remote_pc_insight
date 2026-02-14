# CLI/Web Security Audit (2026-02-14)

## Scope
- CLI (`agent`) <-> API (`server`) 통신 보안
- Web (`web`) <-> API (`server`) 인증/세션/브라우저 보안
- 대상 리포지토리: `remote_pc_insight`

## Executive Summary
- 현재 구조는 기본 인증/권한 분리(사용자/디바이스), 토큰 해시 저장, 리프레시 토큰 회전, 기본 레이트리밋을 갖추고 있습니다.
- 다만 실제 운영 관점에서 즉시 보완이 필요한 항목(P0/P1)이 존재합니다.
- 가장 큰 리스크는 `CLI 기본 비TLS 통신 허용`과 `로컬 디바이스 토큰 파일 권한`입니다.

## What Is Working Well
- `enroll/device/refresh` 토큰을 DB에 해시로 저장 (`server/app/core/security.py:27`, `server/app/core/database.py:54`, `server/app/core/database.py:83`, `server/app/core/database.py:183`)
- 디바이스 revoke 시 토큰 즉시 폐기 (`server/app/api/v1/routers/devices.py:669`)
- 리프레시 토큰 회전 구현 (`server/app/api/v1/routers/auth.py:174`)
- 브라우저 저장소(`localStorage/sessionStorage`)에 액세스 토큰 미저장 (현재 메모리 상태만 사용) (`web/lib/api.ts:15`)
- 기본 보안 헤더 일부 적용 (`web/next.config.js:18`)

---

## Findings By Priority

### P0 (Critical)
- [x] **P0-CLI-HTTPS-001: CLI가 기본적으로 HTTP를 사용하며 비TLS 서버를 차단하지 않음**
  - Evidence: `agent/src/commands/link.ts` 기본값 `https://localhost:8000` 변경, URL 검증/차단 로직 추가
  - Evidence: `agent/src/core/api/client.ts`에서도 non-localhost HTTP 차단
  - Impact: 운영 환경에서 MITM 시 등록 토큰/디바이스 토큰 탈취 가능, 디바이스 위장 및 리포트 위변조 위험
  - Fix:
    - 기본값을 `https://`로 변경
    - `localhost/127.0.0.1` 외에는 HTTP 차단
    - 개발용 예외는 `--allow-insecure-http` 같은 명시적 플래그로만 허용

- [ ] **P0-OPS-SECRET-001: 실서비스 API 키가 로컬 `.env`에 평문 존재 (운영 유출 가능성 관리 필요)**
  - Evidence: `server/.env:7`에 `GLM_API_KEY` 실키 값 존재
  - Impact: 키 유출 시 외부 과금/오용/모델 호출 로그 노출 가능
  - Fix:
    - 즉시 키 로테이션
    - 배포 환경은 `.env` 직접 노출 금지(권한 최소화/배포 파이프라인 주입)
    - 커밋 이력/공유 채널(메신저, 스크린샷, 로그) 노출 여부 점검

### P1 (High)
- [x] **P1-CLI-FS-001: CLI 토큰 저장 파일 권한이 과도하게 열려 있음**
  - Evidence (코드): `agent/src/core/store/config.ts`에 디렉토리 `0700`, 파일 `0600` 적용 + `chmod` 보정
  - Impact: 동일 호스트의 다른 로컬 사용자/프로세스가 `deviceToken` 탈취 가능
  - Fix:
    - 디렉토리 `0700`, 파일 `0600` 강제
    - 가능하면 OS Keychain/Keyring 저장으로 전환

- [x] **P1-API-CSRF-001: 쿠키 인증 경로에 대한 CSRF 방어가 명시적으로 없음**
  - Evidence: `server/app/api/v1/deps.py`에 cookie-auth state-changing 요청에 대해 `Origin/Referer + X-PCInsight-CSRF` 검증 추가
  - Evidence: `server/app/api/v1/routers/auth.py` refresh/logout에도 CSRF 검증 적용
  - Current Mitigation: `SameSite=Lax` (`server/app/core/config.py:20`)
  - Impact: 브라우저 쿠키 인증 기반 상태 변경 요청이 보조 통제 없이 동작
  - Fix:
    - CSRF 토큰(Double Submit 또는 Synchronizer) 도입
    - 추가로 Origin/Referer 검증

- [x] **P1-RL-IP-001: 레이트리밋 클라이언트 식별 시 `X-Forwarded-For`를 무조건 신뢰**
  - Evidence: `server/app/services/request_rate_limit.py`에서 `trust_proxy_headers` 설정이 켜진 경우만 XFF 신뢰
  - Impact: 직접 노출 환경에서 헤더 스푸핑으로 IP 기반 제한 우회 가능
  - Fix:
    - 신뢰 프록시에서만 XFF 사용
    - 그 외에는 `request.client.host` 강제

- [x] **P1-AGENT-RL-001: Agent 엔드포인트에 요청 제한이 사실상 없음**
  - Evidence: `server/app/api/v1/routers/agent.py`의 enroll/next/status/report/heartbeat에 rate limit 적용
  - Impact: 토큰 추측/무차별 호출/리소스 소모형 DoS 표면 확대
  - Fix:
    - `/v1/agent/enroll`, `/commands/next`, `/reports`, `/status`에 per-IP + per-device 제한 적용

### P2 (Medium)
- [x] **P2-WEB-TOKEN-EXPOSURE-001: 쿠키 세션을 쓰면서도 access token을 응답 본문으로 노출**
  - Evidence: `web/lib/api.ts`에서 토큰 메모리 저장/Authorization 재전송 제거, cookie-session 중심으로 동작 변경
  - Impact: XSS 발생 시 탈취 가능한 인증 재료가 증가
  - Fix:
    - 브라우저는 HttpOnly cookie only 전략으로 단순화
    - 응답 본문 access token 제거(또는 서버-서버 용도와 분리)

- [x] **P2-WEB-CSP-001: CSP(Content-Security-Policy) 부재**
  - Evidence: `web/next.config.js`에 CSP 헤더 추가(dev/prod 분기)
  - Impact: XSS 발생 시 피해 완화 계층 부족
  - Fix:
    - 최소한 `default-src 'self'; script-src 'self'; object-src 'none'; frame-ancestors 'none'` 수준의 CSP 도입
    - 필요 스크립트 도메인 화이트리스트 점진 확장

- [x] **P2-API-PAGINATION-001: 명령 조회 API `limit` 상한 미설정**
  - Evidence: `server/app/api/v1/routers/commands.py` `limit`에 `ge=1, le=100` 적용
  - Impact: 과대 `limit` 요청으로 DB/응답 부하 증가 가능
  - Fix:
    - `Query(..., ge=1, le=100)` 형태로 상한 고정

- [x] **P2-SHARE-TOKEN-001: 공유 링크 토큰이 DB 평문 저장**
  - Evidence: `server/app/core/database.py`에 `share_token_hash` 컬럼 추가
  - Evidence: `server/app/api/v1/routers/reports.py` 생성/조회/폐기에서 hash 기반 처리(legacy plain token 호환 유지)
  - Impact: DB 접근 유출 시 유효 공유 링크 즉시 악용 가능
  - Fix:
    - share token도 해시 저장, 생성 시 1회만 평문 반환

### P3 (Low)
- [x] **P3-CLI-RESILIENCE-001: CLI fetch 타임아웃/취소 제어 없음**
  - Evidence: `agent/src/core/api/client.ts`에 timeout(`AbortController`) + retry(backoff) 공통 적용
  - Impact: 네트워크 비정상 시 무기한 대기/운영 불안정
  - Fix:
    - 공통 timeout + retry(backoff) 도입

- [x] **P3-API-HARDENING-001: TrustedHostMiddleware/운영용 docs 제어 미적용**
  - Evidence: `server/app/main.py`에 production/staging 대상 trusted hosts 적용
  - Evidence: `server/app/core/config.py` + `server/app/main.py`에 API docs on/off 설정 연동
  - Impact: 운영 노출면 관리 미흡
  - Fix:
    - 운영에서 trusted host 제한
    - 운영 환경에서는 docs/redoc 비활성화 옵션 적용

---

## Communication Path Verdict
- CLI와 Web은 직접 통신하지 않음.
- 실질 경로는 다음 2개:
  - `CLI -> FastAPI`
  - `Web Browser -> FastAPI`
- 따라서 보안 핵심은 API 계층(인증/세션/레이트리밋/TLS 강제)입니다.

## Recommended Execution Order
1. P0-CLI-HTTPS-001, P0-OPS-SECRET-001 즉시 처리
2. P1-CLI-FS-001, P1-API-CSRF-001, P1-RL-IP-001, P1-AGENT-RL-001
3. P2/P3를 스프린트로 묶어 단계 적용
