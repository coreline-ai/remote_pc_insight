#!/usr/bin/env bash
set -euo pipefail

COMFYUI_ROOT="${COMFYUI_ROOT:-$HOME/ComfyUI}"
COMFYUI_ENDPOINT="${COMFYUI_ENDPOINT:-http://127.0.0.1:8188/system_stats}"
WORKFLOW_DIR="${COMFYUI_WORKFLOW_DIR:-$COMFYUI_ROOT/user/default/workflows}"
MODEL_ROOT="${COMFYUI_MODEL_ROOT:-$COMFYUI_ROOT/models}"

status=0

pass() {
  printf '[PASS] %s\n' "$1"
}

warn() {
  printf '[WARN] %s\n' "$1"
}

fail() {
  printf '[FAIL] %s\n' "$1"
  status=1
}

check_dir() {
  local path="$1"
  local label="$2"
  if [[ -d "$path" ]]; then
    pass "$label: $path"
  else
    fail "$label missing: $path"
  fi
}

check_glob() {
  local pattern="$1"
  local label="$2"
  if compgen -G "$pattern" >/dev/null; then
    pass "$label found ($pattern)"
  else
    fail "$label not found ($pattern)"
  fi
}

echo "ComfyUI/Wan readiness check"
echo "- Endpoint : $COMFYUI_ENDPOINT"
echo "- Root     : $COMFYUI_ROOT"
echo "- Workflows: $WORKFLOW_DIR"

echo
if command -v curl >/dev/null 2>&1; then
  if curl -fsS --max-time 2 "$COMFYUI_ENDPOINT" >/dev/null; then
    pass "ComfyUI endpoint is reachable"
  else
    fail "ComfyUI endpoint is not reachable (expected running server at 127.0.0.1:8188)"
  fi
else
  fail "curl is required but not installed"
fi

echo
check_dir "$WORKFLOW_DIR" "Workflow directory"
check_dir "$MODEL_ROOT/diffusion_models" "Diffusion model directory"
check_dir "$MODEL_ROOT/text_encoders" "Text encoder directory"
check_dir "$MODEL_ROOT/vae" "VAE directory"
check_dir "$MODEL_ROOT/clip_vision" "CLIP vision directory"

echo
check_glob "$MODEL_ROOT/diffusion_models/wan*" "Wan diffusion model"
check_glob "$MODEL_ROOT/text_encoders/umt5*" "Wan text encoder"
check_glob "$MODEL_ROOT/vae/wan*" "Wan VAE"
check_glob "$MODEL_ROOT/clip_vision/*clip*" "CLIP vision model"
check_glob "$WORKFLOW_DIR/*wan*" "Wan workflow file"

if [[ "$(uname -s)" == "Darwin" && "$(uname -m)" == "arm64" ]]; then
  cpu_brand="$(sysctl -n machdep.cpu.brand_string 2>/dev/null || true)"
  echo
  warn "Detected macOS Apple Silicon (${cpu_brand:-unknown CPU})"
  warn "Recommended path on M4: start with Wan2.2 GGUF Q4/Q5 and <= 576x1024, 81 frames"
  warn "Not recommended on local M4: Wan2.2 14B fp16 full-quality pipeline (high memory pressure)"
fi

echo
if [[ "$status" -eq 0 ]]; then
  echo "READY: ComfyUI/Wan extension prerequisites are satisfied."
else
  echo "NOT READY: Fix failed items above and rerun this script."
fi

exit "$status"
