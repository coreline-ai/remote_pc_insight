#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_PATH="$ROOT_DIR/tmp/intro.mp4"
WEB_PUBLIC_OUT="$ROOT_DIR/web/public/intro.mp4"
WHITE_BG="$ROOT_DIR/docs/design/white/screen.png"
BLACK_BG="$ROOT_DIR/docs/design/black/screen.png"

DURATION=48
WIDTH=1920
HEIGHT=1080
FPS=30
FORCE=0

FONT_FILE="${FONT_FILE:-}"
FFMPEG_BIN="${FFMPEG_BIN:-ffmpeg}"

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
  filters="$("$bin" -hide_banner -filters 2>/dev/null || true)"
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

[[ -f "$WHITE_BG" ]] || die "Missing background image: $WHITE_BG"
[[ -f "$BLACK_BG" ]] || die "Missing background image: $BLACK_BG"

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

FILTER_SCRIPT="$(mktemp)"
cleanup() {
  rm -f "$FILTER_SCRIPT"
}
trap cleanup EXIT

declare -a TIMEPOINTS
for i in {0..8}; do
  TIMEPOINTS[$i]="$(awk -v d="$DURATION" -v n="$i" 'BEGIN { printf "%.3f", (d * n) / 8 }')"
done

CAPTIONS=(
  "pc-insight AI Cloud"
  "여러 대의 PC를 웹에서 한눈에 관리"
  "원격 건강검진을 클릭 한 번에 실행"
  "AI 코파일럿이 위험도와 우선순위 제안"
  "디스크 네트워크 시작프로그램 추세 분석"
  "파일 내용은 수집하지 않는 프라이버시 설계"
  "Agent 연결 명령 실행 리포트 확인까지"
  "지금 바로 pc-insight AI Cloud를 시작하세요"
)

{
  echo "[1:v]scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=increase,crop=${WIDTH}:${HEIGHT},format=rgba[white];"
  echo "[2:v]scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=increase,crop=${WIDTH}:${HEIGHT},format=rgba[black];"
  echo "[0:v][black]overlay=0:0:enable='between(t,${TIMEPOINTS[0]},${TIMEPOINTS[2]})+between(t,${TIMEPOINTS[4]},${TIMEPOINTS[6]})'[v01];"
  echo "[v01][white]overlay=0:0:enable='between(t,${TIMEPOINTS[2]},${TIMEPOINTS[4]})+between(t,${TIMEPOINTS[6]},${TIMEPOINTS[8]})'[v02];"

  printf "[v02]drawbox=x=0:y=ih-220:w=iw:h=220:color=black@0.58:t=fill,"
  printf "drawtext=fontfile='%s':text='프로젝트 소개 영상':fontcolor=yellow:fontsize=42:x=(w-text_w)/2:y=h*0.13:shadowcolor=black@0.85:shadowx=2:shadowy=2:enable='between(t,%s,%s)'," \
    "$FONT_FILE" "${TIMEPOINTS[0]}" "${TIMEPOINTS[1]}"

  for i in "${!CAPTIONS[@]}"; do
    start="${TIMEPOINTS[$i]}"
    end="${TIMEPOINTS[$((i + 1))]}"
    text="${CAPTIONS[$i]}"
    text="${text//:/\\:}"
    text="${text//\'/\\\'}"

    size=52
    if [[ "$i" -eq 0 ]]; then
      size=62
    fi

    printf "drawtext=fontfile='%s':text='%s':fontcolor=white:fontsize=%s:x=(w-text_w)/2:y=h-150:shadowcolor=black@0.90:shadowx=3:shadowy=3:enable='between(t,%s,%s)'," \
      "$FONT_FILE" "$text" "$size" "$start" "$end"
  done

  echo "format=yuv420p[vout]"
} >"$FILTER_SCRIPT"

OVERWRITE_FLAG="-n"
if [[ "$FORCE" -eq 1 ]]; then
  OVERWRITE_FLAG="-y"
fi

"$FFMPEG_BIN" -hide_banner -loglevel error "$OVERWRITE_FLAG" \
  -f lavfi -i "color=c=black:s=${WIDTH}x${HEIGHT}:r=${FPS}:d=${DURATION}" \
  -loop 1 -i "$WHITE_BG" \
  -loop 1 -i "$BLACK_BG" \
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

echo "Generated intro video: $OUT_PATH"
echo "Updated landing video asset: $WEB_PUBLIC_OUT"
