# INSTALL_AGENT.md — Run Agent Automatically (Production)

목표: 사용자가 터미널을 켜지 않아도, 로그인 시 자동으로 `pc-insight agent`가 실행되게 한다.

---

## 1) 공통 전제
- Agent는 반드시 link 완료되어 config에 device_token이 있어야 함
- 추천 실행 옵션:
  - interval: 8000ms
  - 네트워크 오류 시 자동 백오프

---

## 2) macOS (launchd LaunchAgent)
- 설치 개념:
  - ~/Library/LaunchAgents 에 plist 파일 배치
  - launchctl load 로 등록

필수 구성:
- Label: com.pcinsight.agent
- ProgramArguments:
  - pc-insight
  - agent
- RunAtLoad: true
- KeepAlive: true
- StandardOutPath / StandardErrorPath: 로그 파일 경로

주의:
- PATH 문제로 node/npm bin 경로가 다를 수 있음
- 절대 경로로 실행 파일 지정 권장

---

## 3) Windows (Task Scheduler)
- 설치 개념:
  - 로그인 시 트리거
  - 작업 실행: pc-insight agent
  - "가장 높은 권한" 여부는 수집 기능에 따라 결정

필수 구성:
- Trigger: At log on
- Action:
  - Program: pc-insight
  - Arguments: agent
- Restart on failure 설정 권장

---

## 4) Linux (systemd --user)
- 설치 개념:
  - ~/.config/systemd/user/pc-insight-agent.service
  - systemctl --user enable --now

필수 구성:
- ExecStart=pc-insight agent
- Restart=always
- RestartSec=5

---

## 5) v1 권장: CLI 자동 설치 커맨드
- `pc-insight install-agent`
- `pc-insight uninstall-agent`
- OS별 템플릿 생성/적용 자동화

---
