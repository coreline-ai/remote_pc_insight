# DEPLOYMENT.md — Deployment Guide (Backend + Web)

## 1) Backend (FastAPI)
권장: Docker + Managed Postgres

필수 환경변수:
- DATABASE_URL
- JWT_SECRET (v1)
- CORS_ORIGINS (web origin)
- LOG_LEVEL

운영 권장:
- Reverse Proxy (TLS)
- DB connection pool 설정
- Migration 도구 적용(예: alembic)

---

## 2) Web (Next.js)
필수 환경변수:
- NEXT_PUBLIC_API_BASE (예: https://api.example.com)

운영 권장:
- CDN
- Cache 정책(정적 리소스)
- auth callback URL 설정(OAuth 사용 시)

---

## 3) Database
- Postgres 14+ 권장
- 필수 인덱스:
  - commands(device_id, status, created_at)
  - reports(device_id, created_at desc)
  - device_tokens(token_hash unique)

---

## 4) Secrets & Config
- 토큰/시크릿은 안전한 환경변수 주입 방식 사용 권장
- 로그에 토큰 출력 금지

---
