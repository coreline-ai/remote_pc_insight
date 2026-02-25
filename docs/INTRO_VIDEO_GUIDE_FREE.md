# 무료 소개 영상 제작 가이드 (FFmpeg + ComfyUI/Wan 옵션)

`pc-insight AI Cloud`의 랜딩 소개 영상을 과금 없이 로컬에서 만드는 표준 워크플로우입니다.

## 1) 적용 범위

- 기본 경로: `FFmpeg` 기반 1분 미만 무음 자막 소개 영상 생성
- 확장 경로(옵션): `ComfyUI + Wan2.x` 기반 AI 영상 생성
- 기본 산출물:
  - `tmp/intro.mp4`
  - `web/public/intro.mp4`

## 2) 웹 마켓플레이스 스킬 분석

| 스킬 | 소스 | 무료 여부 | 코덱스 호환성 | 적용 역할 |
|------|------|-----------|---------------|-----------|
| `ffmpeg` | `mrgoonie/xxxnaper` (`.claude/skills/ffmpeg`) | 무료(로컬 OSS) | 설치 가능 | 최종 MP4 제작 메인 엔진 |
| `video-editor` | `ckorhonen/claude-skills` (`skills/video-editor`) | 무료(로컬 OSS) | 설치 가능 | 인코딩/화질/컨테이너 운영 가이드 |
| `wan2-i2v` | `fumiya-kume/toy-poodle-love` (`.claude/skills/wan2-i2v`) | 무료(모델 다운로드 필요) | 설치 가능 | ComfyUI 기반 I2V 확장 경로 |
| `generate-with-comfyui` | `erosDiffusion/ComfyUI-Erosdiffusion-LTX2` (`.agent/skills/generate-with-comfyui`) | 무료(로컬 ComfyUI) | 설치 가능 | ComfyUI 워크플로우 호출 자동화 |

## 3) 스킬 설치/검증

```bash
# 1) ffmpeg 스킬
python3 ~/.codex/skills/.system/skill-installer/scripts/install-skill-from-github.py \
  --repo mrgoonie/xxxnaper \
  --path .claude/skills/ffmpeg

# 2) video-editor 스킬
python3 ~/.codex/skills/.system/skill-installer/scripts/install-skill-from-github.py \
  --repo ckorhonen/claude-skills \
  --path skills/video-editor

# 3) wan2-i2v 스킬
python3 ~/.codex/skills/.system/skill-installer/scripts/install-skill-from-github.py \
  --repo fumiya-kume/toy-poodle-love \
  --ref master \
  --path .claude/skills/wan2-i2v

# 4) generate-with-comfyui 스킬
python3 ~/.codex/skills/.system/skill-installer/scripts/install-skill-from-github.py \
  --repo erosDiffusion/ComfyUI-Erosdiffusion-LTX2 \
  --ref master \
  --path .agent/skills/generate-with-comfyui

# 설치 상태 확인
python3 ~/.codex/skills/.system/skill-installer/scripts/list-skills.py --format json
ls -la ~/.codex/skills
```

설치 후 Codex를 재시작하면 새 스킬 인식이 안정적입니다.

## 4) 무료 소개 영상 생성 (기본 경로)

### 준비

```bash
# macOS
brew install ffmpeg
```

### 생성

```bash
./scripts/generate_intro_video_free.sh --force
```

옵션:

- `--out <path>`
- `--duration <sec>` (40~55)
- `--width <px>`
- `--height <px>`
- `--fps <num>`
- `--force`

### 결과 검증

```bash
ffprobe -v error -select_streams v:0 \
  -show_entries stream=codec_name,width,height,duration \
  -of default=noprint_wrappers=1:nokey=0 tmp/intro.mp4

ls -lh tmp/intro.mp4 web/public/intro.mp4
```

## 5) 랜딩 페이지 반영

`web/.env.production.example`의 인터페이스를 그대로 사용합니다.

```bash
export NEXT_PUBLIC_INTRO_VIDEO_URL="/intro.mp4"
```

## 6) ComfyUI/Wan 확장 (옵션, 연결 점검만)

대용량 모델 풀셋업은 본 가이드 범위 밖이며, 준비 상태 점검만 제공합니다.

```bash
./scripts/check_comfyui_wan_readiness.sh
```

점검 항목:

- `127.0.0.1:8188` ComfyUI 엔드포인트 응답
- 워크플로우 디렉토리 존재
- Wan 관련 모델 디렉토리/파일 존재
- macOS Apple Silicon(M4 포함) 권장/비권장 경로 안내

## 7) 비용/운영 기준

- 기본 영상 제작 경로는 로컬 FFmpeg만 사용하며 API 과금이 없습니다.
- ComfyUI/Wan은 오픈 모델 기반으로 라이선스/모델 다운로드/하드웨어 비용만 고려하면 됩니다.
- 유료 SaaS(Render API, hosted video gen)는 이 기본 경로에서 제외합니다.

## 8) 트러블슈팅

- `ffmpeg not found`
  - `brew install ffmpeg` 후 새 터미널에서 재시도
- `drawtext filter is unavailable` 오류
  - `brew install ffmpeg-full` 설치 후 재시도
  - 필요 시 `export FFMPEG_BIN=/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg`
- 한글 자막이 깨짐
  - `FONT_FILE` 환경변수로 한글 폰트 경로 지정
  - 예: `export FONT_FILE=/System/Library/Fonts/Supplemental/AppleGothic.ttf`
- `ComfyUI endpoint is not reachable`
  - ComfyUI 실행 후 `http://127.0.0.1:8188/system_stats` 응답 확인
- M4에서 Wan 고해상도 생성이 느리거나 실패
  - GGUF Q4/Q5, 해상도/프레임 수를 낮춰 테스트
