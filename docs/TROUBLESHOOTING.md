# TROUBLESHOOTING.md — Troubleshooting

## 1) link가 실패합니다
- Enrollment Token이 만료되었을 수 있습니다 → 웹에서 토큰 재발급
- server URL이 올바른지 확인

## 2) 웹에서 명령을 보내도 실행이 안 됩니다
- agent가 실행 중인지 확인: `pc-insight agent`
- PC가 오프라인이면 queued로 남습니다
- device last_seen_at을 확인하세요

## 3) 리포트가 업로드되지 않습니다
- 네트워크/서버 오류일 수 있습니다
- outbox에 쌓이는지 확인: `pc-insight outbox`
- 서버 payload 크기 제한이 있을 수 있습니다(큰 JSON 축약 필요)

## 4) 경로가 보이지 않습니다
- 기본 정책은 Level 0(경로 숨김)입니다
- 디바이스 설정에서 업로드 레벨을 올려야 합니다(v1)

## 5) 중복 실행이 됩니다
- processed store가 정상인지 확인
- 동일 PC에서 agent 프로세스가 여러 개 실행 중인지 확인(자동 실행 설치 시 중복 주의)

---
