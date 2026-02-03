# README.md — pc-insight Cloud (Agent + Server + Web)

pc-insight Cloud는 **내 PC를 로컬에서 분석**하고, **웹에서 여러 대 PC를 통합 관리**하며, **웹에서 원격 명령으로 점검을 실행**할 수 있는 시스템입니다.

- ✅ 분석은 로컬에서 실행 (파일 내용 수집 X)
- ✅ 웹에서 여러 대 PC 상태 통합
- ✅ 원격 명령(allowlist)으로 재점검 가능
- ✅ 업로드 데이터는 기본 “요약”만(경로 숨김), 필요 시 옵트인

---

## 구성요소

1) **Agent (CLI)**
- PC에 설치되는 명령줄 도구
- 로컬 분석 후 리포트 생성/업로드
- 서버의 명령 큐를 폴링해서 원격 실행 수행

2) **Backend (FastAPI)**
- 사용자 인증(웹)
- 디바이스 등록/토큰 관리
- 커맨드 큐/상태/리포트 저장

3) **Web (Next.js)**
- 디바이스 대시보드
- 진행률/히스토리
- 리포트 뷰어
- 새 PC 연결(등록 토큰 발급/복사)

---

## 빠른 시작 (로컬 개발)

### 1) Backend 실행
- Postgres 준비 후 환경변수 설정: `DATABASE_URL`
- 실행: `uvicorn app.main:app --reload --port 8000`

### 2) Web 실행
- 환경변수: `NEXT_PUBLIC_API_BASE=http://localhost:8000`
- 실행: `npm run dev`

### 3) 새 PC 연결
1) 웹에서 “새 PC 연결” → 명령어 복사
2) PC 터미널에서 실행: `pc-insight link <ENROLL_TOKEN> --server http://localhost:8000`
3) 에이전트 실행: `pc-insight agent`

---

## 원격 명령 타입 (MVP)
- RUN_FULL
- RUN_DEEP
- RUN_STORAGE_ONLY
- RUN_PRIVACY_ONLY
- RUN_DOWNLOADS_TOP
- PING

---

## 프라이버시 기본 정책
- 파일 **내용**은 수집/전송하지 않습니다.
- 서버 업로드는 기본 “요약(Level 0)”이며 **경로는 숨김**입니다.
- 파일명/경로 업로드는 디바이스 설정에서 옵트인됩니다.

자세한 내용: `PRIVACY.md`

---

## 문서 목록
- 제품 요구사항: `PRD.md`
- 기술 요구사항: `TRD.md`
- API 스펙: `API.md`
- 아키텍처: `ARCHITECTURE.md`
- 배포: `DEPLOYMENT.md`
- 운영 런북: `RUNBOOK.md`
- 에이전트 자동 실행: `INSTALL_AGENT.md`
- 보안: `SECURITY.md`
- 문제 해결: `TROUBLESHOOTING.md`

---
