# MASTER PLAN

> pc-insight Cloud 프로젝트의 기술적 계약서입니다. 모든 구현은 이 문서를 100% 준수합니다.

---

## 1. Project Identity

| 항목 | 값 |
|------|------|
| **PLATFORM_MODE** | HYBRID (Web + CLI Agent) |
| **PRIMARY_TYPE** | NEXTJS + FASTAPI + NODE_CLI |
| **LANGUAGE** | TypeScript (Agent, Web) + Python (Backend) |

---

## 2. Platform & Repo Flags

| 항목 | 값 |
|------|------|
| **BACKEND_REQUIRED** | YES |
| **REPO_LAYOUT** | APPS_SPLIT (`/agent`, `/server`, `/web`) |
| **PACKAGE_MANAGER** | pnpm (Web/Agent), pip/poetry (Backend) |

---

## 3. Tech Stack (Pinned Versions)

### Frontend (Web)
| 라이브러리 | 버전 |
|-----------|------|
| Next.js | 14.2.x (App Router) |
| React | 18.3.x |
| TypeScript | 5.4.x |
| TailwindCSS | 3.4.x |
| React Query | 5.x |

### Backend (Server)
| 라이브러리 | 버전 |
|-----------|------|
| Python | 3.11+ |
| FastAPI | 0.110.x |
| Uvicorn | 0.29.x |
| asyncpg | 0.29.x |
| Pydantic | 2.6.x |
| python-jose | 3.3.x (JWT) |
| passlib | 1.7.x (bcrypt) |

### Agent (CLI)
| 라이브러리 | 버전 |
|-----------|------|
| Node.js | 20 LTS |
| TypeScript | 5.4.x |
| Commander | 12.x |
| node-fetch | 3.x |

### Database
| 항목 | 값 |
|------|------|
| PostgreSQL | 14+ |
| Migration | Alembic |

### Tooling
| 도구 | 용도 |
|------|------|
| ESLint | Linting (TS) |
| Prettier | Formatting |
| Black/Ruff | Python Linting |
| Docker | 컨테이너 |

---

## 4. Platform Detection Evidence

| 항목 | 값 |
|------|------|
| **WEB_SCORE** | 6 |
| **APP_SCORE** | 2 |
| **CLI_SCORE** | 4 |

### Evidence
- **WEB 키워드**: Dashboard, Admin, URL, SSR, SEO (PRD.md, TRD.md)
- **CLI 키워드**: Agent, Terminal, CLI, Background Service (PRD.md, INSTALL_AGENT.md)
- **APP 키워드**: 없음 (모바일 앱 언급 없음)

**결론**: Web Dashboard + CLI Agent = **HYBRID** (Web 중심 + CLI 도구)

---

## 5. Architecture

### 5.1 Design Pattern
- **Backend**: Clean Architecture (Layered: Routers → Services → Repositories)
- **Web**: Feature-based Organization + React Query for Server State
- **Agent**: Command Pattern + Pipeline Pattern

### 5.2 Folder Structure Tree

```
/
├── agent/                      # CLI Agent (Node.js/TypeScript)
│   ├── src/
│   │   ├── commands/           # CLI 명령어 (link, agent, run)
│   │   ├── core/               # 핵심 로직
│   │   │   ├── analyzer/       # 로컬 분석 파이프라인
│   │   │   ├── api/            # 서버 API 클라이언트
│   │   │   └── store/          # 로컬 저장소 (config, outbox, processed)
│   │   ├── utils/              # 유틸리티
│   │   └── index.ts            # 엔트리포인트
│   ├── package.json
│   └── tsconfig.json
│
├── server/                     # Backend (FastAPI/Python)
│   ├── app/
│   │   ├── api/
│   │   │   ├── v1/
│   │   │   │   ├── routers/    # API 라우터
│   │   │   │   │   ├── tokens.py
│   │   │   │   │   ├── devices.py
│   │   │   │   │   ├── commands.py
│   │   │   │   │   ├── reports.py
│   │   │   │   │   └── agent.py
│   │   │   │   └── deps.py     # 의존성 (인증 등)
│   │   │   └── __init__.py
│   │   ├── core/
│   │   │   ├── config.py       # 설정
│   │   │   ├── security.py     # 인증/토큰
│   │   │   └── database.py     # DB 연결
│   │   ├── models/             # Pydantic 모델
│   │   ├── services/           # 비즈니스 로직
│   │   ├── repositories/       # DB 접근 계층
│   │   └── main.py             # 앱 엔트리포인트
│   ├── migrations/             # Alembic 마이그레이션
│   ├── pyproject.toml
│   └── alembic.ini
│
├── web/                        # Frontend (Next.js)
│   ├── app/
│   │   ├── (auth)/             # 인증 관련 페이지
│   │   │   ├── login/
│   │   │   └── register/
│   │   ├── (dashboard)/        # 대시보드
│   │   │   ├── devices/
│   │   │   │   ├── page.tsx    # 목록
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx # 상세
│   │   │   └── reports/
│   │   │       └── [id]/
│   │   │           └── page.tsx
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── ui/                 # 공통 UI 컴포넌트
│   │   ├── devices/            # 디바이스 관련 컴포넌트
│   │   ├── commands/           # 커맨드 관련 컴포넌트
│   │   └── reports/            # 리포트 관련 컴포넌트
│   ├── lib/
│   │   ├── api.ts              # API 클라이언트
│   │   └── auth.ts             # 인증 유틸
│   ├── hooks/                  # React Hooks
│   ├── package.json
│   └── tailwind.config.js
│
├── docs/                       # 문서
├── ops/                        # 운영 스크립트
└── README.md
```

---

## 6. Implementation Tasks (병렬 실행 계획)

> **병렬 실행 원칙**: 폴더 소유권(Owner) 기반으로 독립적으로 개발 가능한 영역을 분리합니다.

### Phase 1 – Setup (기반 구축) [순차]

| # | Task | Owner | 의존성 |
|---|------|-------|--------|
| 1.1 | 프로젝트 구조 생성 (`agent/`, `server/`, `web/`) | PM | - |
| 1.2 | Backend: FastAPI 기본 설정 + DB 연결 | Server | - |
| 1.3 | Backend: Alembic 마이그레이션 설정 + 스키마 생성 | Server | 1.2 |
| 1.4 | Web: Next.js 초기화 + TailwindCSS 설정 | Web | - |
| 1.5 | Agent: Node.js/TypeScript 프로젝트 초기화 | Agent | - |

**Checkpoint**: 모든 프로젝트 빌드 성공

---

### Phase 2 – Core Logic (핵심 로직) [병렬 가능]

#### 2A. Backend APIs (Owner: `server/`)

| # | Task | API Endpoint |
|---|------|--------------|
| 2A.1 | 사용자 인증 (JWT) | - |
| 2A.2 | Enrollment Token 발급 | `POST /v1/tokens/enroll` |
| 2A.3 | Agent Enroll | `POST /v1/agent/enroll` |
| 2A.4 | 디바이스 CRUD | `GET/POST /v1/devices` |
| 2A.5 | 커맨드 큐 | `POST /v1/devices/{id}/commands`, `GET /v1/agent/commands/next` |
| 2A.6 | 커맨드 상태 업데이트 | `POST /v1/agent/commands/{id}/status` |
| 2A.7 | 리포트 업로드/조회 | `POST /v1/agent/reports`, `GET /v1/reports/{id}` |
| 2A.8 | 디바이스 Revoke | `POST /v1/devices/{id}/revoke` |

#### 2B. Agent CLI (Owner: `agent/`)

| # | Task | CLI Command |
|---|------|-------------|
| 2B.1 | Config Store | `~/.pc-insight/config.json` |
| 2B.2 | Link Command | `pc-insight link <TOKEN>` |
| 2B.3 | Agent Polling Loop | `pc-insight agent` |
| 2B.4 | Command Executor | 명령 타입별 분기 |
| 2B.5 | 분석 파이프라인 (FULL) | 스토리지/프라이버시/슬로우다운 |
| 2B.6 | 리포트 생성 + 업로드 | - |
| 2B.7 | Outbox 재시도 | 실패 시 로컬 저장/재시도 |
| 2B.8 | Processed Store | 중복 실행 방지 |

#### 2C. Web Dashboard (Owner: `web/`)

| # | Task | Page/Component |
|---|------|----------------|
| 2C.1 | 레이아웃 + 네비게이션 | `layout.tsx` |
| 2C.2 | 로그인/회원가입 | `/login`, `/register` |
| 2C.3 | 디바이스 목록 | `/devices` |
| 2C.4 | 디바이스 상세 + 커맨드 히스토리 | `/devices/[id]` |
| 2C.5 | 새 PC 연결 모달 | `<ConnectDeviceModal />` |
| 2C.6 | 원격 명령 버튼 | `<CommandButtons />` |
| 2C.7 | 리포트 상세 | `/reports/[id]` |
| 2C.8 | 진행률 폴링 | React Query + 2초 간격 |

---

### Phase 3 – Integration & Polish [순차]

| # | Task | 설명 |
|---|------|------|
| 3.1 | E2E 테스트 | 등록 → 명령 → 리포트 전체 흐름 |
| 3.2 | 에러 처리 통합 | 일관된 에러 코드/메시지 |
| 3.3 | 로그 마스킹 | 토큰/민감정보 제거 |
| 3.4 | README 업데이트 | 로컬 개발 가이드 |

---

## 7. Risks & Fallback

| Risk | Fallback Strategy |
|------|-------------------|
| DB 연결 실패 | SQLite로 로컬 개발 폴백 |
| JWT 구현 복잡 | 초기에는 API Key 기반 인증 |
| 병렬 개발 충돌 | 폴더 소유권 명확화 + 인터페이스 계약 선정의 |
| Agent 자동 실행 OS 호환 | MVP에서는 수동 실행, v1에서 자동화 |
| 대용량 리포트 | Payload 크기 제한 (2MB) |

---

## 8. Success Criteria

- [ ] 모든 프로젝트 빌드 성공 (`npm run build`, `uvicorn`, `tsc`)
- [ ] E2E 흐름 성공: Token 발급 → Link → Command → Report
- [ ] 웹에서 디바이스 목록/상세/리포트 조회 가능
- [ ] Agent에서 폴링/실행/업로드 성공
- [ ] 토큰이 DB에 hash로 저장됨
