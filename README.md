<div align="center">

# 🖥️ pc-insight AI Cloud (Coreline AI)

**당신의 PC, 이제 웹에서 한눈에 관리하세요.**

<p float="left">
  <img width="40%" height="2172" alt="screencapture-127-0-0-1-3001-2026-02-14-14_32_47" src="https://github.com/user-attachments/assets/d093623b-271b-4268-a297-9e2eb3fc62ff" />
  <img width="40%" height="2172" alt="screencapture-127-0-0-1-3001-devices-2026-02-14-14_33_30" src="https://github.com/user-attachments/assets/56fc96db-1efe-414c-a125-02e0c23cb567" />
</p>

[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14.2-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[📖 문서](#-문서) • [🚀 빠른 시작](#-빠른-시작) • [✨ 기능](#-기능) • [📐 아키텍처](#-아키텍처)

</div>

---

## 📋 소개

**pc-insight AI Cloud**는 여러 대의 PC를 웹에서 통합 관리하고, 원격으로 건강검진을 실행할 수 있는 **하이브리드 PC 관리 플랫폼**입니다.

> **핵심 가치**: 분석은 로컬에서, 관리는 웹에서. 파일 내용은 절대 수집하지 않습니다.

### 왜 pc-insight AI Cloud인가?

| 기존 방식 | pc-insight AI Cloud |
|-----------|------------------|
| PC마다 일일이 확인 | 웹 대시보드에서 모든 PC 상태를 한눈에 |
| 느려진 원인을 모름 | 자동 분석 후 원인과 해결책 제시 |
| CLI 명령이 어려움 | 웹에서 클릭 한 번으로 점검 실행 |
| 개인정보 우려 | 파일 내용 수집 X, 경로 기본 숨김 |

---

## 🆕 최신 업데이트 (2026-02-14)

| 항목 | 업데이트 내용 |
|------|---------------|
| **브랜딩** | `pc-insight Cloud` → `pc-insight AI Cloud` 명칭 통일 |
| **AI 코파일럿** | 디바이스 상세에서 운영자/관리자 뷰 전환 지원 |
| **AI 엔진 선택** | `/devices`에서 전역 AI 엔진(GLM4.5 / OpenAI) 선택 지원 |
| **자연어 질의(MVP)** | 위험 디바이스 조회를 자연어로 질의/탐색 가능 |
| **온보딩 UX** | 새 PC 연결 팝업 개선 (원커맨드/스크립트/설치 가이드) |
| **모바일 대응** | 새 PC 연결 팝업 내부 스크롤 지원(스마트폰 화면 대응) |
| **세션 안정화** | 계정 전환 시 캐시 초기화로 사용자 표시 꼬임 이슈 개선 |
| **한글화 개선** | 추세 지표/명령 히스토리 등 UI 텍스트 한글화 정리 |

---

## 🤖 AI 도입

pc-insight AI Cloud는 리포트 조회를 넘어, **실행 가능한 조치(Action)**까지 제안하는 AI 운영 경험을 제공합니다.

### AI 적용 범위

| 기능 | 설명 |
|------|------|
| **AI 운영 코파일럿** | 최신 리포트/상태 기반 요약, 리스크 수준, 권장 액션 제안 |
| **운영자/관리자 뷰** | 운영자: 즉시 실행 중심 / 관리자: 영향도·우선순위 중심 |
| **자연어 질의** | "가장 위험한 PC 5대" 같은 질문으로 디바이스 탐색 |
| **추세 분석** | 최근 7일 지표 변화(핑 지연, 디스크 여유, 시작 프로그램) 시각화 |
| **AI 운영 지표** | 요청/성공/실패/제한/Fallback 카운트 제공 |

### AI 런타임

- **지원 엔진**: `GLM4.5`, `OpenAI`
- **선택 위치**: `/devices`의 `AI 엔진 설정 (MVP)` (전역 설정)
- **적용 범위**: 디바이스 상세 AI 요약/권장 액션 전체
- **Fallback 전략**: API 오류/키 미설정/제한 초과 시 규칙 기반 요약으로 자동 대체

---

## ✨ 기능

### 🟢 현재 구현됨 (MVP)

| 기능 | 설명 |
|------|------|
| **🔐 사용자 인증** | 이메일/비밀번호 로그인 & 회원가입 (JWT) |
| **📡 디바이스 등록** | 웹에서 토큰 발급 → CLI로 PC 연결 |
| **🖥️ 멀티 디바이스** | 여러 대 PC를 한 계정에서 관리 |
| **⚡ 원격 점검** | 웹에서 클릭 한 번으로 PC 건강검진 실행 |
| **📊 리포트 조회** | 디스크, 시작 프로그램, 건강 점수 확인 |
| **🔌 연결 해제** | Revoke (기록 유지) / Delete (완전 삭제) |
| **📦 Outbox & Retry** | 네트워크 장애 시 자동 재시도 |
| **🛡️ 프라이버시** | 파일 내용 미수집, 경로 기본 숨김 |
| **🎨 모던 UI/UX** | TailwindCSS 기반의 반응형 대시보드 및 다크 모드 지원 |

### 🟡 개발 예정 (v1)

| 기능 | 설명 |
|------|------|
| **🚀 자동 실행** | PC 부팅 시 Agent 자동 시작 (LaunchAgent, Task Scheduler) |
| **📝 체크리스트** | 리포트 항목 → "할 일 목록"으로 변환 |
| **⚙️ 업로드 정책** | Level 0/1/2 프라이버시 설정 |
| **🔄 재시도 버튼** | 실패한 명령 다시 실행 |

---

## 📐 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                         사용자 PC                               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  pc-insight Agent (CLI)                                  │   │
│  │  • 로컬 분석 (디스크, 프로세스, 시작 프로그램)            │   │
│  │  • 서버 폴링 → 명령 수신 → 실행 → 리포트 업로드           │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │ HTTPS
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         서버 (FastAPI)                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Auth Router  │  │ Device Router│  │ Agent Router │          │
│  │ (JWT, Users) │  │ (CRUD, Revoke│  │ (Enroll,     │          │
│  │              │  │  Commands)   │  │  Poll, Report)│         │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                              │                                  │
│                       PostgreSQL DB                             │
└─────────────────────────────────────────────────────────────────┘
                              │ REST API
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         웹 프론트엔드 (Next.js)                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  /devices    │  │/devices/[id] │  │/reports/[id] │          │
│  │  (목록)      │  │ (상세/명령)   │  │ (리포트 뷰어) │         │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📂 프로젝트 구조

모노레포(Monorepo) 구조로 구성되어 있으며, 각 컴포넌트는 독립적인 기술 스택을 사용합니다.

| 분류 | 디렉토리 | 기술 스택 | 주요 특징 |
|------|---------|-----------|------------|
| **Web Frontend** | `/web` | **Next.js 14** (App Router) | TailwindCSS, React Query, TypeScript 기반의 모던 웹 대시보드 |
| **Backend API** | `/server` | **FastAPI** (Python) | AsyncPG, Pydantic, JWT Auth, RESTful API 설계 |
| **CLI Agent** | `/agent` | **Node.js 20+** | Commander.js, Cross-platform (Win/Mac/Linux) 지원 |

---

## 🚀 빠른 시작

### 사전 요구사항

- **Node.js** 20 LTS
- **Python** 3.11+
- **PostgreSQL** 14+
- **pnpm** (권장) 또는 npm

### 1. 저장소 클론

```bash
git clone https://github.com/your-org/remote_pc_insight.git
cd remote_pc_insight
```

### 2. 백엔드 실행

```bash
cd server

# 가상환경 생성 및 의존성 설치
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# 환경변수 설정
export DATABASE_URL="postgresql://user:pass@localhost:5432/pcinsight"
export JWT_SECRET="your-secret-key"
export CORS_ORIGINS="http://localhost:3001"

# 서버 실행
uvicorn app.main:app --reload --port 8001
```

### 3. 웹 프론트엔드 실행

```bash
cd web

# 의존성 설치
pnpm install  # 또는 npm install

# 환경변수 설정
export NEXT_PUBLIC_API_BASE="http://localhost:8001"

# 개발 서버 실행
pnpm dev  # 또는 npm run dev
```

### 4. Agent 빌드 및 연결

```bash
cd agent

# 의존성 설치 및 빌드
pnpm install && pnpm build

# 글로벌 설치 (선택)
pnpm link --global

# PC 연결 (웹에서 발급받은 토큰 사용)
pc-insight link <ENROLL_TOKEN> --server http://localhost:8001

# Agent 실행
pc-insight agent
```

---

## 🛠️ 원격 명령 타입

| 명령 타입 | 설명 | 예상 소요 시간 |
|-----------|------|----------------|
| `PING` | 연결 상태 확인 | < 1초 |
| `RUN_FULL` | 전체 건강검진 | ~30초 |
| `RUN_DEEP` | 상세 분석 (중복 파일 탐지 포함) | ~5분 |
| `RUN_STORAGE_ONLY` | 디스크 용량 분석만 | ~10초 |
| `RUN_PRIVACY_ONLY` | 프라이버시 분석만 | ~10초 |
| `RUN_DOWNLOADS_TOP` | 다운로드 폴더 분석 | ~15초 |

---

## 🔒 프라이버시 정책

> **우리는 당신의 파일 내용을 절대 수집하지 않습니다.**

| 수준 | 수집 내용 | 기본값 |
|------|----------|--------|
| **Level 0** | 요약 정보만 (점수, 개수, 용량) | ✅ 기본 |
| **Level 1** | + 파일명 (경로 제거) | 옵트인 |
| **Level 2** | + 전체 경로 | 옵트인 |

자세한 내용은 [`docs/PRIVACY.md`](docs/PRIVACY.md)를 참조하세요.

---

## 📖 문서

| 문서 | 설명 |
|------|------|
| [`docs/PRD.md`](docs/PRD.md) | 제품 요구사항 |
| [`docs/FUNCTIONAL_SPEC.md`](docs/FUNCTIONAL_SPEC.md) | 기능 명세서 |
| [`docs/API_SPEC.md`](docs/API_SPEC.md) | API 스펙 |
| [`docs/DB_SCHEMA.md`](docs/DB_SCHEMA.md) | 데이터베이스 스키마 |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | 아키텍처 설계 |
| [`docs/SECURITY.md`](docs/SECURITY.md) | 보안 가이드 |
| [`docs/PRIVACY.md`](docs/PRIVACY.md) | 프라이버시 정책 |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | 배포 가이드 |
| [`docs/INSTALL_AGENT.md`](docs/INSTALL_AGENT.md) | Agent 설치 가이드 |
| [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md) | 문제 해결 |

---

## 🤝 기여하기

기여를 환영합니다! [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md)를 참조하세요.

---

## 📄 라이선스

이 프로젝트는 MIT 라이선스를 따릅니다. 자세한 내용은 [`LICENSE`](LICENSE) 파일을 참조하세요.

---

<div align="center">

Made with ❤️ by the **pc-insight** Team

</div>
