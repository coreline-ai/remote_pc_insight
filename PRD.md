# PRD — pc-insight Cloud (멀티 디바이스 PC 건강검진 · 정리 코치 · 원격 운영 대시보드)
Version: 0.9 (Draft)
Owner: Hwan Choi
Date: 2026-02-03
Status: Draft (MVP 정의 완료)

---

## 0) 코드블럭 깨짐 사전 원인 분석 (문서 작성 규칙)

이 PRD는 **단일 fenced code block(```md ... ```)** 안에만 존재하도록 구성했습니다. 아래 규칙을 지키면 코드블럭이 깨지지 않습니다.

### 자주 깨지는 원인
1. 문서 본문에 ```(백틱 3개) 또는 ~~~(틸드 3개)가 추가로 등장
2. 예시 명령어/코드를 표시하려고 또 다른 fenced code block을 중첩
3. 복사/붙여넣기 과정에서 백틱 개수가 바뀌거나 앞뒤 공백이 끼어듦
4. 텍스트 에디터 자동 포맷팅(특히 Markdown 확장)이 백틱을 변형
5. 표/리스트 중간에 백틱이 줄 단위로 깨지며 닫힘 처리됨

### 방지 전략 (본 문서 적용)
- 내부에 **추가 fenced code block을 절대 사용하지 않음**
- 명령어나 코드 조각은 **인라인 코드(한 줄 `...`)** 또는 **들여쓰기(4 spaces)** 로만 표기
- 문서 끝까지 ```md 블럭을 닫지 않으며, 맨 마지막 줄에서만 닫음
- "```" 문자열 자체가 문서 안에 나오지 않도록 회피

---

## 1) 제품 개요 (Problem / Vision)

### 1.1 문제 정의 (초보자 관점)
- 컴퓨터가 느려졌지만 왜 느린지 모른다.
- 용량 부족 알림이 떠도 무엇을 지워야 할지 모르겠다.
- 정리는 잘못 지울까 봐 두렵고, 어디부터 시작해야 하는지 막막하다.
- 노트북/데스크탑/회사 PC 등 **여러 대**를 쓰면 상태를 통합 관리할 방법이 없다.

### 1.2 비전
"한 번 설치한 에이전트가 각 PC를 로컬로 분석하고, 웹에서 여러 대 PC 상태를 통합 관리하며, 필요할 때 웹에서 원격 명령으로 재점검/부분 점검을 수행한다."

핵심 메시지:
- 설치는 쉽고 (npx)
- 분석은 로컬에서
- 웹은 통합 대시보드 + 원격 명령
- 자동 삭제는 하지 않고, 사용자 통제권 유지
- 개인정보는 기본 최소 수집

---

## 2) 목표 / 비목표

### 2.1 목표 (Goals)
G1. 사용자는 웹 대시보드에서 여러 대 PC 상태를 한눈에 본다.  
G2. 웹에서 특정 PC에 "지금 점검" 등 원격 명령을 내려 실행시킨다.  
G3. 점검 결과는 서버에 저장되고 웹에서 조회 가능하다.  
G4. 결과 리포트에서 클릭하면 "정리 체크리스트"가 자동 생성되며 **파일 단위** 항목까지 생성 가능하다.  
G5. 기본 프라이버시 정책: 파일 내용은 수집하지 않으며, 경로는 기본 숨김(옵트인).

### 2.2 비목표 (Non-Goals)
N1. 원격으로 사용자의 파일을 자동 삭제/이동하는 기능은 MVP 범위에서 제외한다.  
N2. 실시간 화면 공유/원격 데스크톱 제어는 범위 밖이다.  
N3. 기업용 AD/SSO, 조직 권한 모델은 MVP 이후 단계로 미룬다.  
N4. 모든 OS/환경에서 완벽한 프로세스/시작프로그램 목록 수집을 보장하지 않는다(권한/OS 제약 고려).

---

## 3) 사용자/페르소나/주요 시나리오

### 3.1 페르소나
P1. 초보 사용자 (개인)
- 컴퓨터가 느리면 불안하지만, 무엇을 해야 할지 모른다.
- 터미널 사용 경험이 거의 없다.

P2. 파워 유저
- 여러 대 PC를 쓰며 주기적으로 상태 점검을 자동화하고 싶다.

P3. 소규모 팀 관리자 (향후)
- 팀원의 PC 상태를 요약 수준으로 모니터링하고 싶다(개인정보 최소).

### 3.2 주요 사용자 시나리오 (MVP)
S1. 새 PC 연결
- 웹에서 "새 PC 연결" 버튼 클릭 → 등록 토큰 발급
- PC에서 `pc-insight link <ENROLL_TOKEN> --server <API_BASE>` 실행
- 웹 대시보드에 디바이스가 추가됨

S2. 원격 점검 실행
- 웹에서 디바이스 카드에서 "지금 점검" 클릭
- 명령이 queued → 에이전트가 수신(running) → 리포트 업로드(succeeded)
- 웹에서 최신 점수/한 문장/리포트 확인

S3. 체크리스트 생성 (파일 단위)
- 웹에서 리포트의 "Downloads 큰 파일 후보"에서 "+ 추가" 클릭
- 체크리스트에 "파일 확인" 항목이 생성됨
- 사용자가 로컬에서 직접 확인/삭제/이동 후 체크 처리

S4. 오프라인 상태에서의 처리
- PC가 오프라인이면 queued 유지 → TTL 이후 expired
- 웹에서 "오프라인일 수 있음" 안내 + 에이전트 실행 방법 표시

---

## 4) 제품 범위 (MVP / v1 / vNext)

### 4.1 MVP (필수)
- 사용자 계정(단일 사용자) 로그인: 최소 Email+Password 또는 OAuth 1종
- 디바이스 등록(Enrollment Token 발급 + link)
- 디바이스 토큰(Device Token) 기반 에이전트 인증
- 원격 명령 큐(queued/running/succeeded/failed/expired)
- 에이전트 폴링 기반 명령 수신
- 리포트 업로드 및 저장, 웹 조회
- 대시보드: 디바이스 목록, 디바이스 상세, 커맨드 히스토리, 리포트 상세(요약 + Raw JSON)
- 프라이버시 기본 정책: 경로 숨김, 파일 내용 미수집
- 안정성: outbox(업로드 실패 재시도), processed store(중복 실행 방지)

### 4.2 v1 (권장)
- 에이전트 자동 실행(로그인 시 백그라운드 서비스 설치)
- 디바이스 revoke/토큰 재발급 UI
- 업로드 데이터 레벨(요약/파일명/경로) 디바이스별 정책
- 리포트 비교(최근 7/30일 점수 추이)
- 커맨드 재시도 버튼
- 서버 모니터링/로그/알림(Sentry 등)

### 4.3 vNext (확장)
- WebSocket/SSE 기반 실시간 진행률 스트림
- 조직(Org) + 권한(Role) 모델
- 정리 자동화(휴지통 이동 등) 기능은 매우 강한 안전장치(2단계 확인, 화이트리스트 폴더, 감사 로그) 이후 고려

---

## 5) 기능 요구사항 (Functional Requirements)

### 5.1 계정/인증
FR-A1. 사용자는 웹에서 로그인할 수 있어야 한다.  
FR-A2. 서버는 사용자 인증(JWT/세션)을 검증하고 사용자별 리소스 접근을 제한한다.  
FR-A3. 에이전트 인증은 사용자 인증과 분리된 Device Token으로 한다.  
FR-A4. 토큰은 서버 DB에 평문 저장하지 않고 hash로 저장한다.

### 5.2 디바이스 등록/관리
FR-D1. 웹에서 Enrollment Token을 발급할 수 있어야 한다(기본 TTL 설정).  
FR-D2. CLI는 `link`로 Enrollment Token을 제출해 디바이스를 등록한다.  
FR-D3. 서버는 등록 완료 시 Device Token을 1회 반환한다.  
FR-D4. 디바이스는 이름/OS/버전/마지막 접속 시간을 가진다.  
FR-D5. 사용자는 웹에서 디바이스 연결을 끊을 수 있어야 한다(revoke).  
FR-D6. revoke 시 해당 디바이스는 더 이상 명령 수신 및 업로드를 할 수 없어야 한다.

### 5.3 원격 명령 (Command Queue)
FR-C1. 웹에서 디바이스별 원격 명령을 생성할 수 있어야 한다.  
FR-C2. 명령은 allowlist 타입만 허용한다(임의 shell command 금지).  
FR-C3. 에이전트는 서버에서 명령을 폴링으로 가져와 실행한다.  
FR-C4. 명령 상태는 queued/running/succeeded/failed/expired/canceled 중 하나를 가진다.  
FR-C5. 명령은 TTL이 지나면 expired 처리한다.  
FR-C6. 에이전트는 실행 중 진행률/메시지를 서버에 업데이트할 수 있어야 한다.

명령 타입(MVP):
- PING
- RUN_FULL
- RUN_DEEP
- RUN_STORAGE_ONLY
- RUN_PRIVACY_ONLY
- RUN_DOWNLOADS_TOP

### 5.4 리포트 생성/업로드/조회
FR-R1. 에이전트는 로컬에서 리포트를 생성한다.  
FR-R2. 에이전트는 리포트를 서버에 업로드한다(command_id와 연결).  
FR-R3. 서버는 대시보드 표시를 위한 요약 컬럼(점수/한 문장/디스크 여유 등)을 저장한다.  
FR-R4. 서버는 Raw JSON 저장을 지원한다(추후 암호화/옵트인 강화 가능).  
FR-R5. 웹은 디바이스별 최신 리포트 및 리포트 상세를 조회할 수 있어야 한다.

### 5.5 체크리스트 UX (파일 단위 포함)
FR-U1. 리포트에서 "추천 항목"을 클릭하면 체크리스트에 항목이 생성되어야 한다.  
FR-U2. "Downloads 큰 파일 후보" 테이블에서 개별 파일 후보를 체크리스트 항목으로 추가할 수 있어야 한다.  
FR-U3. 체크리스트는 진행률(완료/전체)을 표시한다.  
FR-U4. 자동 삭제는 하지 않으며 사용자가 직접 정리한다.

---

## 6) 데이터/프라이버시 요구사항 (Privacy by Default)

### 6.1 기본 원칙
PRV-1. 파일 내용(문서 본문, 이미지 픽셀 등)을 서버로 전송하지 않는다.  
PRV-2. 서버 업로드는 기본 "요약" 수준이며 경로는 숨김이다.  
PRV-3. 경로/파일명 전송은 사용자가 명시적으로 허용한 경우에만 가능하다(옵트인).  
PRV-4. 사용자가 언제든 디바이스를 revoke 할 수 있어야 한다.

### 6.2 업로드 데이터 레벨 (정책)
- Level 0 (Default): 요약만 저장 (경로/파일명 전송 안함)
- Level 1: 파일명만 전송 (경로 제거)
- Level 2: 전체 경로 전송

정책은 디바이스 설정(서버)에서 강제되어야 하며, 에이전트가 임의로 override 할 수 없다.

---

## 7) 비기능 요구사항 (NFR)

### 7.1 안정성
NFR-1. 서버 일시 장애/네트워크 단절 시에도 에이전트는 결과를 로컬(outbox)에 저장하고 재시도한다.  
NFR-2. 동일 command_id 중복 실행/중복 업로드를 방지한다(processed store).  
NFR-3. 명령 실행이 실패하면 실패 사유를 message로 남긴다.

### 7.2 성능
NFR-4. RUN_FULL은 일반 PC에서 30초 이내(목표), 최악 2분 이내 완료를 목표로 한다(환경 차 고려).  
NFR-5. RUN_DEEP은 파일 수에 따라 장시간 수행될 수 있으며 진행률 표시가 필요하다.

### 7.3 보안
NFR-6. 토큰/민감 데이터는 로그에 남기지 않는다.  
NFR-7. 토큰은 DB에 hash로 저장한다.  
NFR-8. 커맨드 타입 allowlist로 RCE 위험을 차단한다.  
NFR-9. 감사 로그(누가 어떤 디바이스에 어떤 명령을 내렸는지)를 남긴다(v1 권장).

### 7.4 관측성(Observability)
NFR-10. 서버는 커맨드 라이프사이클, 업로드 실패율, 평균 실행 시간을 측정한다.  
NFR-11. 에이전트는 마지막 에러/업로드 성공 시각을 저장한다.

---

## 8) 사용자 경험 (UX) 요구사항

### 8.1 온보딩
UX-1. 웹에서 "새 PC 연결"을 누르면 복사 가능한 단일 명령어를 제공한다.  
UX-2. 사용자는 토큰 만료 시간과 재발급 버튼을 볼 수 있어야 한다.  
UX-3. 에이전트 실행 안내(`pc-insight agent`)가 함께 제공되어야 한다.

### 8.2 대시보드
UX-4. 디바이스 목록에서 최신 점수와 한 문장 요약을 보여준다.  
UX-5. 디바이스 상세에서 진행 중인 커맨드의 진행률과 메시지를 실시간(폴링)으로 보여준다.  
UX-6. 오프라인 의심 시(queued가 오래 지속) 가이드를 표시한다.

### 8.3 리포트/체크리스트
UX-7. 리포트에서 클릭하여 체크리스트가 자동 생성되는 흐름이 자연스러워야 한다.  
UX-8. 파일 단위 항목은 기본적으로 경로 숨김 상태로 표기하고, 허용 정책에 따라 표시한다.

---

## 9) 시스템 구성 요소 (High-level)

### 9.1 에이전트(CLI)
- link: 디바이스 등록
- agent: 원격 명령 수신/실행 (폴링)
- run: 수동 실행(옵션) + sync(옵션)
- outbox: 업로드 재시도 큐
- processed: 중복 실행 방지 스토어

### 9.2 서버(FastAPI)
- Auth(웹 로그인)
- Enrollment Token 발급
- Device 관리
- Command Queue
- Report 저장/조회
- 정책(sanitize / 업로드 레벨) 강제

### 9.3 프런트엔드(Web)
- 디바이스 목록
- 디바이스 상세(진행률/히스토리)
- 리포트 상세
- 새 PC 연결 모달
- 디바이스 revoke / 정책 설정 (v1)

---

## 10) API 요구사항 (요약)

웹(사용자 인증 필요):
- POST /v1/tokens/enroll
- GET /v1/devices
- GET /v1/devices/{device_id}
- POST /v1/devices/{device_id}/commands
- GET /v1/devices/{device_id}/commands
- GET /v1/reports/{report_id}
- POST /v1/devices/{device_id}/revoke (v1)

에이전트(DEVICE_TOKEN 필요):
- POST /v1/agent/enroll (ENROLL_TOKEN 기반)
- GET /v1/agent/commands/next
- POST /v1/agent/commands/{id}/status
- POST /v1/agent/reports

---

## 11) 데이터 모델 요구사항 (요약)

필수 테이블:
- users
- enroll_tokens
- devices
- device_tokens
- commands
- reports

핵심 인덱스:
- commands(device_id, status, created_at)
- reports(device_id, created_at)

---

## 12) 운영/배포 요구사항 (Production)

### 12.1 에이전트 자동 실행 (필수)
- macOS LaunchAgent
- Windows Task Scheduler
- Linux systemd --user

### 12.2 버전 호환 정책
- 서버는 최소 지원 agent_version을 정의한다.
- 오래된 agent는 명령 수신 시 경고 또는 제한할 수 있다.

### 12.3 로그/모니터링
- 서버: 에러/지연/실패율 모니터링(Sentry/Prometheus)
- 에이전트: 마지막 성공/실패 상태 로컬 기록

### 12.4 보존/삭제
- 리포트 보존 기간 정책(예: 최근 90일 또는 최근 N개)
- 사용자가 리포트를 삭제할 수 있어야 한다(v1)

---

## 13) 성공 지표 (Metrics)

Product Metrics:
- 주간 활성 디바이스 수(Active Devices / week)
- 명령 실행 성공률 (succeeded / issued)
- 평균 실행 시간 (RUN_FULL, RUN_DEEP)
- 사용자가 체크리스트 항목을 생성한 비율
- 체크리스트 완료율(완료/전체) (선택)

Reliability Metrics:
- 업로드 실패율
- outbox 잔존률(재시도 실패 비율)
- queued → running 전환 시간(오프라인 탐지)

---

## 14) 리스크 및 대응

R1. 원격 명령이 악용될 수 있음
- 대응: allowlist, 임의 쉘 금지, 감사 로그, revoke

R2. 프라이버시 불신
- 대응: 기본 요약만 업로드, 경로 숨김, 정책 설명/투명성 섹션, 옵트인

R3. 에이전트 미실행으로 인한 "작동 안함" 인식
- 대응: 자동 실행(launchd/task), 오프라인 안내 UX, last_seen 표시

R4. OS별 수집 제약
- 대응: best-effort, 기능별 degrade, 사용자에게 명확히 표시

---

## 15) 릴리즈 플랜 (권장)

MVP-0 (Internal):
- link/enroll, command queue, report upload, devices UI, polling

MVP-1 (Public Beta):
- login/JWT, revoke, outbox 안정화, 최소 모니터링

v1:
- agent auto-start, device settings(upload level), report history charts, retry UI

---

## 16) 오픈 질문 (Open Questions)
- 로그인 방식: Email+Password vs OAuth(GitHub/Google) 우선순위
- Raw report 저장 기본값: 저장(기본) vs 저장(옵트인)
- deep duplicate 분석의 기본 포함 여부 및 리소스 제한
- 무료 플랜에서 디바이스 수/리포트 보존 제한 정책

---

## 17) 부록: 용어 정의
- Agent: PC에 설치되는 CLI 프로세스(백그라운드 가능)
- Enrollment Token: 웹에서 발급되는 디바이스 등록용 단기 토큰(1회성)
- Device Token: 디바이스 인증용 장기 토큰(회수 가능)
- Command Queue: 서버에 저장되는 원격 실행 명령 목록
- Report: 에이전트가 생성해 업로드하는 점검 결과 JSON
- Outbox: 업로드 실패 시 로컬에 적재하는 재시도 큐

---
