# 📡 Senior Architect & Analyst Skill (v2)

## Role
- `docs/` 폴더를 **유일한 입력 소스**로 읽고,
- 프로젝트 플랫폼(Web/App/Hybrid)과 기술스택/아키텍처를
- **규칙 기반으로 확정**하여,
- 루트에 `MASTER_PLAN.md`(단일 계약서)를 생성합니다.

출력은 반드시 `MASTER_PLAN.md` 하나로 수렴합니다.

## Platform Detection Rule (MANDATORY)

### 1. Keyword Scoring (점수화)
- **WEB 키워드 발견 시 +2**
  - SEO, SSR, CMS, Admin, Dashboard, URL, Webhook, Browser, Landing, Marketing Site
- **APP 키워드 발견 시 +2**
  - App Store, Play Store, Push, Permission, Offline, Camera, Sensor, BLE, GPS, Background Service

### 2. Decision Rule (판정)
- WEB ≥ 4 and APP < 4 → `PLATFORM_MODE = WEB`
- APP ≥ 4 and WEB < 4 → `PLATFORM_MODE = APP`
- WEB ≥ 4 and APP ≥ 4 → `PLATFORM_MODE = HYBRID`
- 애매한 경우(둘 다 0~2점대):
  - MCP(ChatGPT) 질의 후
  - 여전히 불명확하면 **보수적으로 HYBRID**

### 3. Hard Constraints
- "감으로 판단" 금지
- 반드시 **점수 합산 결과**와 **근거 키워드(문서 내 위치/문장)**를 `MASTER_PLAN.md`에 기록

## ✅ INSERT: Gap-driven Q&A (Field Completion Protocol)

### 목적
`docs/` 문서가 불완전할 때(필수 정보 누락), 추측으로 진행하지 않고 **최소한의 문답(Q&A)**을 통해 `MASTER_PLAN.md`를 **흔들림 없이** 생성하기 위함입니다.

### A. 필수 필드 (Required Fields)
1. **Project Identity**: PLATFORM_MODE, PRIMARY_TYPE, LANGUAGE
2. **Platform & Repo Flags**: BACKEND_REQUIRED, REPO_LAYOUT
3. **Tech Stack**: Frontend, Backend, Database
4. **Platform Detection Evidence**: WEB_SCORE, APP_SCORE, EVIDENCE

### B. Gap Detection (누락 감지 규칙)
1. `docs/PRD.md`를 읽고 Scoring 수행.
2. 점수 불충분(WEB<4, APP<4)하거나 BACKEND_REQUIRED가 모호하면 **GAP** 판정.

### C. Question Generation Rule
- 1회 최대 **5문항** (3문항 권장)
- YES/NO 또는 선택형(A/B/C)만 허용
- **"모르겠다(C)"** 옵션과 **기본값** 필수

### D. Defaulting Policy (응답 없을 시)
- **PLATFORM_MODE**: HYBRID (보수적)
- **BACKEND_REQUIRED**: NO (명시 없으면 최소화)
- **REPO_LAYOUT**: APPS_SPLIT

### E. Output Rule
1. `QNA_REQUEST.md` 생성/출력
2. 답변 수집 후 `MASTER_PLAN.md` Evidence에 병합

## MCP(ChatGPT) Usage (Optional Brain)

### When to Call
1. PRD에 기술스택이 명시되지 않은 경우
2. DB/ERD 초안이 필요한 경우
3. 복잡한 비즈니스 로직의 엣지케이스가 필요한 경우

### Prompt Contract
- 버전 포함(Pinned)
- 폴더 트리 포함
- 대안 1개 포함
- 리스크/폴백 포함
- JSON + Markdown 병행

## Output: `MASTER_PLAN.md` (Strict Contract)

아래 템플릿을 사용하여 `MASTER_PLAN.md`를 생성하세요.

```markdown
# MASTER PLAN

## 1. Project Identity
- PLATFORM_MODE: [WEB | APP | HYBRID]
- PRIMARY_TYPE: [NEXTJS | FLUTTER | ANDROID | IOS]
- LANGUAGE: [TypeScript | Dart | Kotlin | Swift]

## 2. Platform & Repo Flags
- BACKEND_REQUIRED: [YES | NO]
- REPO_LAYOUT: [APPS_SPLIT]
- PACKAGE_MANAGER: [pnpm | yarn | bun | flutter]

## 3. Tech Stack (Pinned Versions)
- Frontend:
- Backend:
- Database:
- Runtime:
- Tooling:

## 4. Platform Detection Evidence
- WEB_SCORE: <number>
- APP_SCORE: <number>
- EVIDENCE:
  - (문서 인용/요약)

## 5. Architecture
- Design Pattern:
- Folder Structure Tree:

## 6. Implementation Tasks
### Phase 1 – Setup
### Phase 2 – Core Logic
### Phase 3 – UI / UX

## 7. Risks & Fallback
- Risk:
- Fallback Strategy:
```

## Constraints
- "적절히", "알아서" 같은 모호 표현 금지
- 라이브러리/프레임워크는 **버전 고정(Pinned)**
- Backend 필요 여부는 반드시 YES/NO로 명시
