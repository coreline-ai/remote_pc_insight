# Render(Backend) + Neon(DB) 배포 체크리스트

이 문서는 `remote_pc_insight`를 기준으로 운영 배포 전/중/후 확인 항목을 정리한 실행 체크리스트입니다.

## 1) 사전 준비

- [ ] Neon 프로젝트/DB 생성 완료
- [ ] Neon DB 사용자 생성 및 최소 권한 부여
- [ ] Neon 연결 문자열 확보 (`sslmode=require`)
- [ ] Render 계정/워크스페이스 준비
- [ ] Render 서비스명/도메인 이름 확정
- [ ] Web 도메인(Vercel 등) 확정

## 2) 코드/설정 준비

- [ ] 루트 `render.yaml` 존재 확인
- [ ] `server/.env.production.example` 기준 운영 env 값 준비
- [ ] `web/.env.production.example` 기준 운영 env 값 준비
- [ ] (권장) 자동 생성 스크립트 실행
  - `scripts/bootstrap_render_neon_env.sh --web-domain https://<your-web-domain> --api-domain https://<your-render-service>.onrender.com --database-url 'postgresql://...sslmode=require'`
- [ ] (권장) 사전 검증 스크립트 실행
  - `scripts/check_production_env.sh`
- [ ] `web/next.config.js`의 CSP `connect-src`에 운영 API 도메인 추가
- [ ] `CORS_ORIGINS`에 웹 도메인 추가
- [ ] `TRUSTED_HOSTS`에 Render API 도메인 추가
- [ ] `JWT_SECRET` 32자 이상 랜덤 값 생성
- [ ] `AUTH_COOKIE_SECURE=true`, `ENABLE_API_DOCS=false`, `MVP_TEST_LOGIN_ENABLED=false` 확인

## 3) Render 배포

- [ ] Render Blueprint로 `render.yaml` 적용 또는 수동 생성
- [ ] `Root Directory=server` 확인
- [ ] Build Command: `pip install -U pip && pip install .`
- [ ] Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- [ ] Health Check Path: `/health`
- [ ] 필수 env 주입:
- [ ] `ENVIRONMENT=production`
- [ ] `DATABASE_URL`
- [ ] `JWT_SECRET`
- [ ] `CORS_ORIGINS` (콤마 구분 또는 JSON 배열 문자열)
- [ ] `TRUSTED_HOSTS` (콤마 구분 또는 JSON 배열 문자열)
- [ ] `AUTH_COOKIE_SECURE=true`
- [ ] `ENABLE_API_DOCS=false`
- [ ] 첫 배포 성공 및 URL 확보 (`https://<service>.onrender.com`)

## 4) Web 배포 연동

- [ ] Web 환경변수 `NEXT_PUBLIC_API_BASE`를 Render URL로 설정
- [ ] Web 재배포 후 브라우저 네트워크에서 API 호출 URL 확인
- [ ] CSP 위반 에러(브라우저 콘솔) 없는지 확인

## 5) 기능 점검 (스모크 테스트)

- [ ] `GET /health` 응답 확인
- [ ] 회원가입/로그인 정상 동작
- [ ] 디바이스 목록 조회
- [ ] 명령 생성 (`RUN_FULL` 등) 가능
- [ ] 리포트 조회 가능
- [ ] 로그아웃/세션 갱신 정상

## 6) 운영 검증

- [ ] Render 로그에 반복 에러(5xx) 없는지 확인
- [ ] Neon 대시보드에서 연결/사용량 한도 확인
- [ ] Free 플랜 cold start 동작(유휴 후 첫 요청 지연) 팀 공유
- [ ] 롤백 기준/연락 채널 문서화

## 7) 트러블슈팅 빠른 점검

- [ ] 401/쿠키 이슈: `AUTH_COOKIE_SECURE`, 도메인, HTTPS 확인
- [ ] CORS 실패: `CORS_ORIGINS` 값(콤마/JSON 포맷) 재확인
- [ ] Host 차단: `TRUSTED_HOSTS`에 현재 API 도메인 포함 여부 확인
- [ ] DB 접속 실패: `DATABASE_URL` 오타/SSL 파라미터 확인
