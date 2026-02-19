# DEPLOYMENT.md — Deployment Guide (Vercel + Neon)

## 1) Target Topology
- Web: Vercel Project (`/web`, Next.js)
- API: Vercel Project (`/server`, FastAPI)
- DB: Neon PostgreSQL

---

## 2) Neon (Database)
1. Neon에서 프로젝트/DB를 생성합니다.
2. 연결 문자열을 준비합니다.
3. `DATABASE_URL`에 `sslmode=require`를 포함합니다.

예시:
- `postgresql://<user>:<password>@<host>/<db>?sslmode=require`

---

## 3) API 배포 (Vercel, server/)
`/server`는 Vercel Python 런타임으로 배포합니다.

배포 전 확인:
- `server/vercel.json`
- `server/api/index.py`
- `server/requirements.txt`

필수 환경변수:
- `ENVIRONMENT=production`
- `DATABASE_URL=<neon-url-with-sslmode=require>`
- `JWT_SECRET=<32+ chars>`
- `AUTH_COOKIE_SECURE=true`
- `AUTH_COOKIE_SAMESITE=none`
- `ENABLE_API_DOCS=false`
- `MVP_TEST_LOGIN_ENABLED=false`
- `CORS_ORIGINS=https://<your-web-domain>`
- `TRUSTED_HOSTS=<your-api-domain>,<your-api-project>.vercel.app`

선택 환경변수:
- `AUTH_COOKIE_DOMAIN`
- `REDIS_URL`
- `ENABLE_AI_COPILOT`
- `OPENAI_API_KEY`
- `GLM_API_KEY`

---

## 4) Web 배포 (Vercel, web/)
`/web`를 별도 Vercel 프로젝트로 배포합니다.

필수 환경변수:
- `NEXT_PUBLIC_API_BASE=https://<your-api-domain>`

선택 환경변수:
- `NEXT_PUBLIC_ENABLE_AI_COPILOT=false`
- `NEXT_PUBLIC_AI_PROVIDER=glm45`

---

## 5) Post-Deploy Validation
1. API 헬스체크: `GET https://<your-api-domain>/health`
2. Web 접속: `https://<your-web-domain>/login`
3. 회원가입/로그인/`/v1/auth/me` 확인
4. 토큰 발급 → Agent 링크 → 디바이스 등록 확인
5. 명령 실행/리포트 업로드/AI 요약 확인

---

## 6) Security Checklist
- 운영에서는 API 문서 비활성화 (`ENABLE_API_DOCS=false`)
- 테스트 로그인 비활성화 (`MVP_TEST_LOGIN_ENABLED=false`)
- 쿠키 보안 강제 (`AUTH_COOKIE_SECURE=true`)
- CORS/Trusted Hosts를 실제 도메인으로 제한
- 민감정보(`JWT_SECRET`, API 키) 로그 출력 금지
