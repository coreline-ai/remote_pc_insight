# RUNBOOK.md — Operations Runbook

## 1) 자주 보는 상태
- 디바이스 last_seen_at
- queued 명령이 오래 유지되는지
- running 명령이 timeout 되는지
- 업로드 실패율(outbox 잔존)

---

## 2) 장애 시나리오

### 2.1 웹에서 명령 실행했는데 반응 없음
체크:
- device last_seen_at이 최신인가?
- PC에서 agent가 실행 중인가?
- commands가 queued 상태로 오래 머무는가?

대응:
- 사용자에게 pc-insight agent 실행 안내
- agent auto-start 설치 안내(INSTALL_AGENT.md)

### 2.2 업로드 실패(outbox 증가)
체크:
- 서버 API 오류/DB 오류
- 네트워크 문제
- payload size 제한 초과

대응:
- 서버 로그 확인
- payload 축약 정책 적용
- outbox flush가 재시도되는지 확인

### 2.3 토큰 유출 의심
대응:
- 해당 디바이스 revoke
- device_tokens revoked 확인
- 감사 로그 조회

---

## 3) 정기 점검
- DB vacuum/analyze
- 인덱스 사용률 확인
- 에러율/latency 모니터링
- 최소 지원 agent 버전 정책 갱신

---
