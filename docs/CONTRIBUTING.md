# CONTRIBUTING.md — Contributing Guide

## 1) Branching
- main: stable
- dev: active development
- feature/*: feature branches

## 2) Code style
- Agent: TypeScript strict, eslint/prettier 권장
- Backend: black/ruff 권장
- Web: lint + typecheck 필수

## 3) Testing
- Unit tests for sanitize, routing, health scoring
- Integration tests: enroll -> command -> report

## 4) Security
- 토큰/시크릿을 커밋하지 마세요
- 민감 로그 금지

---
