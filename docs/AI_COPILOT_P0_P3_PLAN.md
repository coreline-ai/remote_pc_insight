# AI 운영 코파일럿 P0~P3 실행 계획

Last updated: 2026-02-13

## 목표
- 로그인 후 대시보드에서 디바이스 상태를 AI가 `요약 + 우선순위 + 권장 액션`으로 제시한다.
- 운영자가 원문 리포트를 모두 읽지 않아도 즉시 대응할 수 있게 한다.
- 비용/보안/오탐을 통제 가능한 범위에서 단계적으로 확장한다.

## 진행 규칙
- 모든 항목은 완료 시 `[ ]` -> `[x]`로 즉시 업데이트
- 각 우선순위(P0~P3)는 `코드 + 테스트 + 운영 검증`이 끝나야 완료 처리

## P0 (Critical) - 기반/안전성
- [x] P0-1 AI 기능 플래그 추가 (`server`/`web` env): `ENABLE_AI_COPILOT`
- [x] P0-2 AI 요약 저장 스키마 추가 (`reports` 확장 또는 `ai_insights` 테이블 신설)
- [x] P0-3 서버 AI 추론 어댑터 추가 (모델 호출, 타임아웃, 재시도, 장애 시 fallback)
- [x] P0-4 프롬프트 안전 템플릿 적용 (민감정보 제외, 시스템 프롬프트 고정)
- [x] P0-5 비용/성능 가드레일 적용 (요청당 토큰 제한, rate limit, 캐시 TTL)
- [x] P0-6 기본 API 추가: `GET /v1/devices/{id}/ai-summary`
- [x] P0-7 최소 테스트: 단위테스트(파싱/실패처리), 통합테스트(API 200/429/500 fallback)

완료 기준 (DoD):
- AI 미사용 환경에서도 기존 기능 정상 동작
- AI 장애 시 기존 리포트 기반 UI로 자동 fallback
- 로그에 프롬프트 원문/민감정보 저장 금지

## P1 (High) - 핵심 사용자 가치
- [x] P1-1 디바이스 상세 상단에 AI 요약 카드 배치 (한 줄 요약 + 위험도)
- [x] P1-2 권장 액션 버튼 연결 (`RUN_FULL`, `RUN_STORAGE_ONLY`, `PING`)
- [x] P1-3 “왜 이 권장인지” 근거 2~3개 표시 (설명가능성)
- [x] P1-4 홈/목록에서 `위험 디바이스 Top N` 우선 노출
- [x] P1-5 인증 가드 하에서만 AI 데이터 노출 (권한 없는 접근 차단)
- [x] P1-6 E2E 테스트 추가 (로그인 -> 요약 확인 -> 권장 명령 실행)

완료 기준 (DoD):
- 운영자가 10초 이내에 “어떤 PC를 먼저 조치할지” 판단 가능
- 잘못된 액션 자동 실행 없이 항상 사용자 승인 후 실행

## P2 (Medium) - 인텔리전스 확장
- [x] P2-1 시계열 이상징후 탐지 (디스크 여유율, 시작프로그램 급증, 핑 지연)
- [x] P2-2 “최근 7일 변화” AI 비교 요약 추가 (증가/악화/개선)
- [x] P2-3 자연어 질의 MVP (`가장 위험한 PC 5대 보여줘`)
- [x] P2-4 운영 지표 대시보드 (정확도/오탐률/응답시간/요청비용)
- [x] P2-5 관찰성 강화 (요청 추적 ID, 모델 응답 실패 유형 분류)

완료 기준 (DoD):
- 임계치 기반 대비 오탐 감소가 지표로 확인됨
- 질의 기능이 최소 5개 템플릿 질문에서 안정 동작

## P3 (Low) - 최적화/고도화
- [x] P3-1 사용자 역할별 요약 톤 분리 (운영자/관리자)
- [x] P3-2 액션 추천 랭킹 고도화 (과거 성공률 반영)
- [x] P3-3 요약 리포트 내보내기(PDF/링크 공유)
- [x] P3-4 A/B 테스트 (기존 UI vs AI 코파일럿 UI)
- [x] P3-5 모델/프롬프트 버전 관리 및 회귀 평가 자동화

완료 기준 (DoD):
- AI 기능 도입 전 대비 MTTR(문제 인지~조치 시간) 개선 확인
- 비용 상한 내에서 안정 운영 가능

## 구현 순서 (권장)
1. `P0` 먼저 완료: 안전한 기본기 + fallback 확보
2. `P1` 적용: 사용자 체감 가치가 가장 큰 기능 우선
3. `P2` 지능화: 이상탐지/자연어 질의 확장
4. `P3` 최적화: 운영 효율/실험/고도화

## 즉시 착수 백로그 (이번 스프린트)
- [x] S1-1 `ENABLE_AI_COPILOT` 플래그와 서버 설정 추가
- [x] S1-2 AI 요약 API 스켈레톤(`GET /v1/devices/{id}/ai-summary`) 구현
- [x] S1-3 디바이스 상세 페이지에 AI 카드 placeholder 추가
- [x] S1-4 실패 fallback/로딩/빈 데이터 UX 정의
- [x] S1-5 최소 테스트 + 배포 체크리스트 작성

## 배포 체크리스트 (AI 코파일럿 v0)
- [x] `server/.env`의 `ENABLE_AI_COPILOT=true` 확인
- [x] `web/.env.local`의 `NEXT_PUBLIC_ENABLE_AI_COPILOT=true` 확인
- [x] 서버 재시작 후 `GET /v1/devices/{id}/ai-summary` 200 확인
- [x] 웹 재시작 후 디바이스 상세 상단 AI 카드 노출 확인
- [x] AI 비활성 상태(`false`)에서 fallback 문구 노출 확인

## AI Provider 선택 설정
- 서버: `AI_PROVIDER=openai|glm45`, `OPENAI_API_KEY`, `GLM_API_KEY` (현재 기본: `glm45`)
- 웹 기본값: `NEXT_PUBLIC_AI_PROVIDER=openai|glm45` (현재 기본: `glm45`)
- 화면 선택창: 디바이스 상세 AI 카드에서 `OPENAI / GLM4.5` 실시간 전환
- API: `GET /v1/devices/{id}/ai-summary?provider=openai|glm45`

## 실행 검증 로그 (2026-02-13)
- [x] `server`: `pytest -q` 통과 (`17 passed`)
- [x] `server`: `pytest -q tests/e2e` 통과 (`2 passed`)
- [x] `web`: `npm run lint` / `npm run build` 통과
- [x] `agent`: `npm run lint` / `npm run typecheck` / `npm run test -- --run` 통과
- [x] 실서버 스모크: `register -> login -> enroll -> report -> devices/risk-top -> ai-summary -> ai-trends -> ai/query -> reports/export/share` 200 검증
- [x] 실서버 스모크: `ai-trends`에서 `ping_latency_ms` 신호(`degraded`) 검증
- [x] 실서버 스모크: `GET /v1/ai/versions` 활성 버전/사용 분포 검증
- [x] 실서버 스모크: `GET /v1/reports/{id}/export?format=pdf` Base64 PDF(`%PDF-1.4`) 검증
