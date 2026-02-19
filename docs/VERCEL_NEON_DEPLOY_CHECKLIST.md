# VERCEL_NEON_DEPLOY_CHECKLIST.md — Vercel + Neon 배포 체크리스트

## 1) 사전 준비
- [ ] Neon 프로젝트/DB 생성 완료
- [ ] Neon `DATABASE_URL` 확보 (`sslmode=require`)
- [ ] Vercel 팀/프로젝트 권한 확인
- [ ] API 도메인/웹 도메인 확정

## 2) API 프로젝트 (`/server`)
- [ ] Vercel Root Directory를 `server`로 설정
- [ ] `server/vercel.json` 적용 확인
- [ ] `server/api/index.py` 엔트리 확인
- [ ] `server/requirements.txt` 존재 확인
- [ ] 환경변수 설정:
  - [ ] `ENVIRONMENT=production`
  - [ ] `DATABASE_URL` (Neon, SSL 포함)
  - [ ] `JWT_SECRET` (32자 이상)
  - [ ] `AUTH_COOKIE_SECURE=true`
  - [ ] `AUTH_COOKIE_SAMESITE=none`
  - [ ] `ENABLE_API_DOCS=false`
  - [ ] `MVP_TEST_LOGIN_ENABLED=false`
  - [ ] `CORS_ORIGINS=https://<your-web-domain>`
  - [ ] `TRUSTED_HOSTS=<your-api-domain>,<your-api-project>.vercel.app`

## 3) Web 프로젝트 (`/web`)
- [ ] Vercel Root Directory를 `web`로 설정
- [ ] 환경변수 설정:
  - [ ] `NEXT_PUBLIC_API_BASE=https://<your-api-domain>`
  - [ ] `NEXT_PUBLIC_ENABLE_AI_COPILOT` (필요 시)
  - [ ] `NEXT_PUBLIC_AI_PROVIDER` (필요 시)

## 4) 배포 후 검증
- [ ] `https://<your-api-domain>/health` 200 확인
- [ ] `https://<your-web-domain>/login` 접속 확인
- [ ] 회원가입/로그인 성공 확인
- [ ] `/v1/auth/me` 정상 응답 확인
- [ ] 토큰 발급/에이전트 등록/디바이스 조회 확인
- [ ] 명령 실행/리포트 생성/조회 확인
- [ ] 공유 링크 생성/폐기 동작 확인

## 5) 운영 점검
- [ ] Vercel 로그에서 5xx/429 추이 확인
- [ ] Neon 연결 수/쿼리 지연/에러율 모니터링
- [ ] 비밀값 회전 주기 수립(`JWT_SECRET`, AI 키)
- [ ] 장애 대응 절차를 `docs/RUNBOOK.md`와 동기화

