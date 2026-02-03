# SECURITY.md — Security Considerations

## 1) Token Policy
- Enrollment Token:
  - 단기/1회성
  - DB에는 hash만 저장
  - TTL 이후 무효
- Device Token:
  - 장기 토큰(회수 가능)
  - DB에는 hash만 저장
  - 디바이스 revoke 시 즉시 무효

---

## 2) Command Safety
- allowlist 타입만 지원
- 임의 shell 실행 기능 금지
- params 스키마 검증 (unknown field 거부 권장)

---

## 3) Server-side Enforcement
- 디바이스 정책(device_settings)으로 업로드 레벨 강제
- 서버에서 리포트 저장 전 sanitize 2차 적용 권장
- report payload 크기 제한(DoS 방어)

---

## 4) Logging & Secrets
- 토큰/민감정보 로그 금지
- 에러 로그에 request body 그대로 찍지 않기
- Sentry 사용 시 PII scrub 설정

---

## 5) Rate Limiting (v1 권장)
- enroll token 발급 횟수 제한
- agent endpoints QPS 제한
- command 생성 제한

---

## 6) Incident Response (요약)
- 토큰 유출 의심:
  - 해당 디바이스 revoke
  - 관련 토큰 전부 회수
  - 감사 로그 확인
- 취약점 신고: 보안 메일/이슈 템플릿 운영

---
