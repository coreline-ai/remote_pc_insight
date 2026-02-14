# PC Onboarding (Install + Link) Plan

Last updated: 2026-02-14

## Implementation Status (2026-02-14)

- [x] Phase A-1 Web 모달 개선(OS 선택/원커맨드/복사/FAQ)
- [x] Phase A-2 설치 스크립트 템플릿 및 다운로드(`web/lib/onboarding-commands.ts`)
- [x] Phase A-3 토큰 만료 단축 기본값(30분) + 보안 안내 문구
- [x] Phase B-2 온보딩 실행 검증 API(`/v1/tokens/enroll/status`) + Web 연결 확인 버튼
- [ ] Phase B-1 토큰 발급 응답 메타데이터 확장(`recommended_expires_in` 등)
- [ ] Phase C 전 항목(프로토콜 핸들러/플랫폼 패키저)

## 1) 패치 진행 순서 (고정)

아래 순서로 진행합니다.

1. P0 보안 패치
2. P1 보안 패치
3. P2 보안 패치
4. P3 안정화/운영성 패치
5. Web PC 추가 UX 고도화(설치/연결 원클릭에 최대한 근접)

---

## 2) 핵심 질문 답변

### Q. Web에서 토큰과 함께 npm 패키지를 자동 다운로드/설치할 수 있나?

결론: **브라우저만으로는 불가**(보안 샌드박스 제약).

- 브라우저는 사용자의 OS 셸 명령(`npm install -g ...`)을 직접 실행할 수 없음
- 원격 PC에 대해 무권한 자동 설치는 보안상 차단됨
- 따라서 실제 가능한 방식은 다음 3가지

1. 상세 가이드 + 복사 가능한 명령 제공 (가장 현실적)
2. OS별 설치 스크립트 파일 다운로드 제공 (`.sh`/`.ps1`) 후 사용자 실행
3. 로컬 Helper/Protocol(`pcinsight://...`) 설치 후 준-원클릭 (고도화)

---

## 3) 사용자 관점 최적안 (권장)

### 권장안: `2단계 온보딩` + `OS별 원커맨드` + `스크립트 다운로드`

- 단계 1: Web에서 `새 PC 연결` 클릭
  - 토큰 발급(짧은 만료시간, 1회성)
  - OS 선택(macOS/Windows/Linux)
  - 즉시 실행 가능한 명령 1줄 제공
  - `복사` 버튼 + `설치 스크립트 다운로드` 버튼 제공

- 단계 2: 대상 PC에서 실행
  - 명령 1줄 또는 다운로드 스크립트 실행
  - 설치 + 링크 + 초기 헬스체크까지 자동 실행

### 왜 이게 최선인가

- 브라우저 제약을 우회하지 않고도 사용자 클릭 수를 최소화
- 실패 시 원인 파악이 쉬움(터미널 출력)
- 보안 통제(토큰 만료, 1회성) 유지 가능

---

## 4) 구현 범위

## Phase A (필수, 즉시)

### A-1. Web 모달 개선 (`/devices`)
- 파일: `web/app/devices/page.tsx`
- 변경:
  - OS 탭 UI 추가
  - OS별 원커맨드 생성
  - `복사` 버튼
  - `스크립트 다운로드` 버튼
  - 실패 대응 FAQ(권한, npm 없음, PATH 문제)

### A-2. 설치 스크립트 템플릿 제공
- 신규: `web/lib/onboarding-commands.ts`
- 내용:
  - macOS/Linux bash 스크립트 생성 함수
  - Windows PowerShell 스크립트 생성 함수
  - 서버 URL + enroll token을 삽입

### A-3. 보안 가드
- 토큰 기본 만료시간 단축(예: 15~30분)
- 안내 문구: 토큰은 1회성, 타인 공유 금지
- 스크립트 내 `set -e`/오류 처리 및 민감정보 echo 최소화

---

## Phase B (권장, 2차)

### B-1. 온보딩 전용 API 응답 확장
- 파일: `server/app/api/v1/routers/tokens.py`
- 변경:
  - 토큰 발급 시 웹이 바로 사용할 메타데이터 포함
  - 예: `recommended_expires_in`, `server_url`, `agent_version_hint`

### B-2. 온보딩 실행 검증 API
- 신규 엔드포인트: 최근 N분 내 enroll 성공 여부 조회
- Web 모달에서 “연결 확인” 버튼 제공

---

## Phase C (고도화, 준-원클릭)

### C-1. Protocol handler
- CLI에 `pcinsight://link?...` 처리 등록 기능 추가
- 링크 클릭 시 로컬 CLI가 설치/연결 프로세스 실행

### C-2. 플랫폼별 설치 패키지
- npm 글로벌 설치 외에
  - macOS pkg
  - Windows MSI
  - Linux deb/rpm
- 기업 배포 환경 친화성 강화

---

## 5) 보안 체크리스트 (Onboarding 전용)

- [ ] 토큰 만료시간 기본 30분 이하
- [ ] 토큰 단일 사용 보장(이미 구현됨, 회귀 테스트 유지)
- [ ] 스크립트에 장기 키/비밀번호 하드코딩 금지
- [ ] HTTP 서버 주소 경고(운영은 HTTPS 강제)
- [ ] 실행 로그에 토큰 평문 최소화

---

## 6) 수용 기준 (Acceptance Criteria)

- [ ] 사용자는 Web에서 OS 선택 후 1번 복사/다운로드로 설치 준비 완료
- [ ] 대상 PC에서 명령 1회 실행으로 `설치 + 링크 + 초기 실행` 완료
- [ ] 실패 시 메시지가 원인별로 안내됨(Node 없음, 권한 부족, 네트워크 오류)
- [ ] 연결 완료 후 `/devices` 목록에 30초 이내 새 PC 표시

---

## 7) 작업 일정 제안

1. Day 1-2: Phase A 구현 및 UI/문구 정리
2. Day 3: E2E 점검(macOS/Windows)
3. Day 4: Phase B 일부(연결 확인 API)
4. Day 5+: Phase C 설계/PoC
