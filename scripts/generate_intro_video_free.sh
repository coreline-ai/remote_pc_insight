#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_PATH="$ROOT_DIR/tmp/intro.mp4"
WEB_PUBLIC_OUT="$ROOT_DIR/web/public/intro.mp4"

DURATION=48
WIDTH=1920
HEIGHT=1080
FPS=30
FORCE=0

FONT_FILE="${FONT_FILE:-}"
FFMPEG_BIN="${FFMPEG_BIN:-ffmpeg}"
APP_BASE_URL="${APP_BASE_URL:-http://127.0.0.1:3001}"
CHROME_BIN="${CHROME_BIN:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"

usage() {
  cat <<'USAGE'
Usage:
  scripts/generate_intro_video_free.sh [options]

Options:
  --out <path>       Primary output path (default: tmp/intro.mp4)
  --duration <sec>   Video duration in seconds, 40-55 only (default: 48)
  --width <px>       Video width (default: 1920)
  --height <px>      Video height (default: 1080)
  --fps <num>        Frame rate (default: 30)
  --force            Overwrite existing output files
  -h, --help         Show help

Environment:
  FONT_FILE          Optional drawtext font path for Korean subtitles
  APP_BASE_URL       Web base URL to capture (default: http://127.0.0.1:3001)
  CHROME_BIN         Chrome executable path for headless screenshots
  FFMPEG_BIN         ffmpeg executable path
USAGE
}

die() {
  echo "ERROR: $*" >&2
  exit 1
}

is_int() {
  [[ "$1" =~ ^[0-9]+$ ]]
}

has_drawtext_filter() {
  local bin="$1"
  local filters
  filters="$($bin -hide_banner -filters 2>/dev/null || true)"
  grep -q "drawtext" <<<"$filters"
}

pick_font_file() {
  local candidates=(
    "/System/Library/Fonts/Supplemental/AppleGothic.ttf"
    "/System/Library/Fonts/Supplemental/Arial Unicode.ttf"
    "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc"
    "/usr/share/fonts/truetype/nanum/NanumGothic.ttf"
  )
  local candidate
  for candidate in "${candidates[@]}"; do
    if [[ -f "$candidate" ]]; then
      echo "$candidate"
      return 0
    fi
  done
  return 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --out)
      [[ $# -ge 2 ]] || die "--out requires a value"
      OUT_PATH="$2"
      shift 2
      ;;
    --duration)
      [[ $# -ge 2 ]] || die "--duration requires a value"
      DURATION="$2"
      shift 2
      ;;
    --width)
      [[ $# -ge 2 ]] || die "--width requires a value"
      WIDTH="$2"
      shift 2
      ;;
    --height)
      [[ $# -ge 2 ]] || die "--height requires a value"
      HEIGHT="$2"
      shift 2
      ;;
    --fps)
      [[ $# -ge 2 ]] || die "--fps requires a value"
      FPS="$2"
      shift 2
      ;;
    --force)
      FORCE=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      die "Unknown option: $1"
      ;;
  esac
done

is_int "$DURATION" || die "--duration must be an integer"
is_int "$WIDTH" || die "--width must be an integer"
is_int "$HEIGHT" || die "--height must be an integer"
is_int "$FPS" || die "--fps must be an integer"

(( DURATION >= 40 && DURATION <= 55 )) || die "--duration must be within 40-55 seconds"
(( WIDTH >= 640 )) || die "--width must be >= 640"
(( HEIGHT >= 360 )) || die "--height must be >= 360"
(( FPS >= 24 && FPS <= 60 )) || die "--fps must be in 24-60"

if ! command -v "$FFMPEG_BIN" >/dev/null 2>&1; then
  die "ffmpeg binary not found: $FFMPEG_BIN"
fi

if ! has_drawtext_filter "$FFMPEG_BIN"; then
  if [[ -x "/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg" ]] &&
    has_drawtext_filter "/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg"; then
    FFMPEG_BIN="/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg"
  else
    die "drawtext filter is unavailable in ffmpeg. Install ffmpeg-full or set FFMPEG_BIN to a drawtext-capable binary."
  fi
fi

[[ -x "$CHROME_BIN" ]] || die "Chrome binary not found: $CHROME_BIN"
curl -fsS --max-time 3 "$APP_BASE_URL" >/dev/null || die "Cannot reach APP_BASE_URL: $APP_BASE_URL"

if [[ -n "$FONT_FILE" ]]; then
  [[ -f "$FONT_FILE" ]] || die "FONT_FILE not found: $FONT_FILE"
else
  FONT_FILE="$(pick_font_file)" || die "No Korean-capable font found. Set FONT_FILE manually."
fi

if [[ -e "$OUT_PATH" && "$FORCE" -ne 1 ]]; then
  die "Output already exists: $OUT_PATH (use --force)"
fi
if [[ "$OUT_PATH" != "$WEB_PUBLIC_OUT" && -e "$WEB_PUBLIC_OUT" && "$FORCE" -ne 1 ]]; then
  die "Public output already exists: $WEB_PUBLIC_OUT (use --force)"
fi

mkdir -p "$(dirname "$OUT_PATH")" "$ROOT_DIR/tmp" "$ROOT_DIR/web/public"

FRAME_DIR="$(mktemp -d)"
FILTER_SCRIPT="$(mktemp)"
cleanup() {
  rm -rf "$FRAME_DIR"
  rm -f "$FILTER_SCRIPT"
}
trap cleanup EXIT

capture_page() {
  local route="$1"
  local out="$2"
  "$CHROME_BIN" \
    --headless=new \
    --disable-gpu \
    --hide-scrollbars \
    --window-size="${WIDTH},${HEIGHT}" \
    --virtual-time-budget=6000 \
    --screenshot="$out" \
    "${APP_BASE_URL}${route}" >/dev/null 2>&1
}

capture_page "/" "$FRAME_DIR/landing.png"
capture_page "/login" "$FRAME_DIR/login.png"
capture_page "/signup" "$FRAME_DIR/signup.png"

SEG1_END="$(awk -v d="$DURATION" 'BEGIN { printf "%.3f", d * 0.40 }')"
SEG2_END="$(awk -v d="$DURATION" 'BEGIN { printf "%.3f", d * 0.72 }')"

declare -a TIMEPOINTS
for i in {0..8}; do
  TIMEPOINTS[$i]="$(awk -v d="$DURATION" -v n="$i" 'BEGIN { printf "%.3f", (d * n) / 8 }')"
done

CAPTIONS=(
  "현재 코드 기준 pc-insight AI Cloud 소개"
  "최신 랜딩 페이지를 자동 캡처"
  "원격 점검과 멀티 디바이스 관리"
  "로그인 화면 기반 운영 진입 흐름"
  "회원가입 화면 기반 온보딩 흐름"
  "보안 중심 인증과 권한 기반 접근"
  "웹에서 에이전트 연동 후 원격 실행"
  "Coreline AI - pc-insight AI Cloud"
)

{
  echo "[1:v]scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=increase,crop=${WIDTH}:${HEIGHT},format=rgba[landing];"
  echo "[2:v]scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=increase,crop=${WIDTH}:${HEIGHT},format=rgba[login];"
  echo "[3:v]scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=increase,crop=${WIDTH}:${HEIGHT},format=rgba[signup];"
  echo "[0:v][landing]overlay=0:0:enable='between(t,0,${SEG1_END})'[v01];"
  echo "[v01][login]overlay=0:0:enable='between(t,${SEG1_END},${SEG2_END})'[v02];"
  echo "[v02][signup]overlay=0:0:enable='between(t,${SEG2_END},${DURATION})'[v03];"

  printf "[v03]drawbox=x=0:y=ih-220:w=iw:h=220:color=black@0.62:t=fill,"
  printf "drawbox=x=0:y=0:w=iw:h=92:color=black@0.45:t=fill,"
  printf "drawtext=fontfile='%s':text='pc-insight AI Cloud | Live UI Capture':fontcolor=yellow:fontsize=36:x=(w-text_w)/2:y=26:shadowcolor=black@0.85:shadowx=2:shadowy=2:enable='between(t,0,%s)'," \
    "$FONT_FILE" "$DURATION"

  for i in "${!CAPTIONS[@]}"; do
    start="${TIMEPOINTS[$i]}"
    end="${TIMEPOINTS[$((i + 1))]}"
    text="${CAPTIONS[$i]}"
    text="${text//:/\\:}"
    text="${text//\'/\\\'}"

    printf "drawtext=fontfile='%s':text='%s':fontcolor=white:fontsize=50:x=(w-text_w)/2:y=h-148:shadowcolor=black@0.90:shadowx=3:shadowy=3:enable='between(t,%s,%s)'," \
      "$FONT_FILE" "$text" "$start" "$end"
  done

  echo "format=yuv420p[vout]"
} >"$FILTER_SCRIPT"

OVERWRITE_FLAG="-n"
if [[ "$FORCE" -eq 1 ]]; then
  OVERWRITE_FLAG="-y"
fi

"$FFMPEG_BIN" -hide_banner -loglevel error "$OVERWRITE_FLAG" \
  -f lavfi -i "color=c=black:s=${WIDTH}x${HEIGHT}:r=${FPS}:d=${DURATION}" \
  -loop 1 -i "$FRAME_DIR/landing.png" \
  -loop 1 -i "$FRAME_DIR/login.png" \
  -loop 1 -i "$FRAME_DIR/signup.png" \
  -filter_complex_script "$FILTER_SCRIPT" \
  -map "[vout]" \
  -an \
  -c:v libx264 \
  -preset medium \
  -crf 20 \
  -pix_fmt yuv420p \
  -r "$FPS" \
  -t "$DURATION" \
  -movflags +faststart \
  "$OUT_PATH"

if [[ "$OUT_PATH" != "$WEB_PUBLIC_OUT" ]]; then
  cp -f "$OUT_PATH" "$WEB_PUBLIC_OUT"
fi

echo "Generated intro video from current UI: $OUT_PATH"
echo "Updated landing video asset: $WEB_PUBLIC_OUT"
