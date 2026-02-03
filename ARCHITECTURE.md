# ARCHITECTURE.md — System Architecture

## 1) High-level
pc-insight Cloud = Agent + Backend + Web

- Agent: 로컬 분석/원격 명령 수행/리포트 업로드
- Backend: 인증/디바이스/커맨드 큐/리포트 저장/정책 강제
- Web: 디바이스 대시보드/원격 실행 UI/리포트 조회

---

## 2) Data Flow

### 2.1 Device Enrollment
1) Web: enroll token 발급
2) Agent: enroll token 제출하여 등록
3) Server: device token 발급(1회 반환)
4) Agent: 로컬 config에 저장

### 2.2 Remote Command
1) Web: command 생성 (queued)
2) Agent: `/agent/commands/next`로 폴링 → 1개 픽업(running)
3) Agent: 로컬 실행 → 진행률 업데이트
4) Agent: 리포트 업로드 → server 저장 → command succeeded 처리
5) Web: polling로 진행률/결과 표시

### 2.3 Offline Resilience
- 업로드 실패 시 outbox에 저장 → 다음 tick에서 flush

---

## 3) Trust Boundaries
- Web User Auth: 사용자 세션/JWT
- Agent Auth: device token (사용자 토큰과 분리)
- Upload Policy: 서버의 device_settings가 최종 결정(서버가 재마스킹 권장)

---

## 4) Command Allowlist
- 임의 shell 명령 금지
- 정해진 타입만 수용 (RUN_FULL 등)
- params도 안전한 스키마로 제한

---

## 5) Storage
- Postgres:
  - users
  - devices
  - device_tokens
  - commands
  - reports
  - enroll_tokens
  - device_settings (v1)

---

## 6) Extensibility
- 실시간 진행률: SSE/WebSocket으로 확장 가능
- 조직/권한: org + roles로 확장 가능
- 리포트 스키마 버전: `schemaVersion` 도입 권장

---
