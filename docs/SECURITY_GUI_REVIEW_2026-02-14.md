# Security + GUI Review (2026-02-14)

## 범위
- Backend: `server/app/*`
- Web: `web/app/*`, `web/components/*`, `web/lib/api.ts`
- 목표: 보안 리스크와 사용자 관점 필수 기능을 우선순위(P0~P3)로 정리

## 핵심 결론
- 사용자별 데이터 분리는 현재 정상 동작(`devices` 조회 시 `user_id` 필터 적용).
- AI provider 선택/기본 GLM 동작은 정상.
- 다만 인증/공유 링크/대용량 입력/세션 처리에서 보안 하드닝이 추가로 필요.

## P0 (즉시 조치 필요)
- [x] `Auth` 계열 엔드포인트에 전역 Rate Limit 적용 (로그인/회원가입/토큰 생성/공유조회)
  - 근거: `server/app/api/v1/routers/auth.py:16`, `server/app/api/v1/routers/auth.py:38`, `server/app/api/v1/routers/tokens.py:13`, `server/app/api/v1/routers/reports.py:239`
  - 근거: 설정은 있으나 미사용 `server/app/core/config.py:29`
- [x] Agent 리포트 업로드 크기 제한 강제 (`max_report_size_bytes`)
  - 근거: 제한값 정의만 있고 미적용 `server/app/core/config.py:33`
  - 근거: 업로드 시 크기 검증 없음 `server/app/api/v1/routers/agent.py:212`
- [x] 웹 세션 보관 전략 강화 (`sessionStorage` Bearer 토큰 -> HttpOnly Secure Cookie 적용)
  - 근거: 토큰 저장 `web/lib/api.ts:21`, `web/lib/api.ts:36`
  - 리스크: XSS 발생 시 토큰 탈취 가능

## P1 (고우선)
- [x] 입력 검증 강화 (이메일 형식, 비밀번호 최소 길이)
  - 근거: `str` 타입만 사용 `server/app/models/__init__.py:9`, `server/app/models/__init__.py:25`
- [x] 로그인 실패 누적 잠금/지연(anti-bruteforce) 도입
  - 근거: 로그인 실패 처리만 존재 `server/app/api/v1/routers/auth.py:24`
- [x] 공유 링크 수명/폐기 관리 기능 추가 (목록/즉시 revoke API + UI)
  - 근거: 생성/조회만 있고 revoke 엔드포인트 없음 `server/app/api/v1/routers/reports.py:197`, `server/app/api/v1/routers/reports.py:239`
- [x] 공유 토큰 강도 상향 (공개 링크용 random token 128-bit+)
  - 근거: `generate_id`는 UUID 일부(16 hex) 기반 `server/app/core/security.py:70`
  - 근거: 공유 토큰 생성에 사용 `server/app/api/v1/routers/reports.py:217`
- [x] 웹 보안 헤더 추가 (기본 보안 헤더)
  - 근거: Next 설정에 headers 미정의 `web/next.config.js:5`

## P2 (중요)
- [x] JWT 수명/재발급 정책 정교화 (Access + Refresh 회전/강제 로그아웃)
  - 근거: Access token 1일 고정 `server/app/core/config.py:16`
- [x] 401 자동 처리 UX (토큰 만료 시 자동 로그아웃/로그인 유도)
  - 근거: 현재는 토큰 존재 여부만 체크 `web/hooks/use-require-auth.ts:13`
  - 근거: API 401 시 토큰 정리 로직 없음 `web/lib/api.ts:61`
- [x] 레이트리밋 저장소를 Redis(옵션) + 메모리 fallback 구조로 이관
  - 근거: 인메모리 버킷/메트릭 `server/app/services/ai_guardrails.py:8`

## P3 (개선)
- [ ] 보안/운영 감사 로그 체계화 (login/token/share/revoke/audit trail)
- [ ] 환경 설정 정리 (사용하지 않는 설정 제거 또는 실제 적용)
  - 예: `enroll_token_expires_minutes` 현재 미사용 `server/app/core/config.py:19`

## 사용자 관점 GUI 필수 개선 (우선순위)

### UX-P1
- [x] 상단 글로벌 사용자 바(이메일/로그아웃/세션상태) 홈에 적용
  - 현재: 대시보드에만 이메일 표기, 다른 페이지는 일관성 부족
- [ ] 세션 만료 UX 표준화 (토스트 + 재로그인 버튼 + 기존 작업 컨텍스트 보존)
- [x] 공유 링크 관리 화면 (생성된 링크 목록, 만료일, 즉시 폐기)

### UX-P2
- [ ] 디바이스 목록 검색/정렬/필터/페이지네이션
  - 현재: 카드 나열 중심 `web/app/devices/page.tsx:132`
- [ ] 명령 실행 히스토리 UX 개선 (실패 원인 표준 메시지, 재시도 액션)
- [ ] 온보딩 개선 (Agent 설치 -> 링크 -> heartbeat 확인 단계형 진행)
  - 현재: 모달 명령어 중심 안내 `web/app/devices/page.tsx:143`

### UX-P3
- [ ] 빈 상태/에러 상태 가이드 일관화 (행동 가능한 CTA)
- [ ] 접근성 개선 (키보드 포커스/aria/색 대비 점검)

## 바로 실행 가능한 2주 계획
- [x] Week 1: P0 3개(레이트리밋, 업로드 제한, 쿠키 세션 전환 설계/적용)
- [x] Week 2: P1 핵심 3개(입력검증, 공유링크 revoke 관리, 보안헤더)

## 비고
- 최근 반영된 항목(로그인 상태 시작하기 확인 팝업, 대시보드 이메일 표기)은 정상 동작 기준으로 확인됨.
- 추가 반영(2026-02-14): `/v1/auth/refresh`/`/v1/auth/logout` refresh 회전 및 쿠키 세션 재발급, `request_rate_limit` Redis 백엔드(설정 시) + fallback 적용.
