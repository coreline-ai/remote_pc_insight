#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER_ENV_PATH="${ROOT_DIR}/server/.env.production"
WEB_ENV_PATH="${ROOT_DIR}/web/.env.production"

WEB_DOMAIN=""
API_DOMAIN=""
DATABASE_URL=""
JWT_SECRET=""
ENABLE_AI_COPILOT="false"
AI_PROVIDER="glm45"

usage() {
  cat <<'EOF'
Usage:
  scripts/bootstrap_render_neon_env.sh \
    --web-domain https://your-web-domain \
    --api-domain https://your-render-service.onrender.com \
    --database-url 'postgresql://...sslmode=require' \
    [--jwt-secret 'your-32+-char-secret'] \
    [--enable-ai-copilot true|false] \
    [--ai-provider glm45|openai]

Description:
  Generates:
    - server/.env.production
    - web/.env.production
EOF
}

normalize_url() {
  local value="$1"
  if [[ "${value}" =~ ^https?:// ]]; then
    printf "%s" "${value%/}"
  else
    printf "https://%s" "${value%/}"
  fi
}

extract_host() {
  local url="$1"
  local no_scheme="${url#http://}"
  no_scheme="${no_scheme#https://}"
  printf "%s" "${no_scheme%%/*}"
}

generate_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 48 | tr -d '\n'
  else
    echo "ERROR: openssl not found. Pass --jwt-secret explicitly." >&2
    exit 1
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --web-domain)
      WEB_DOMAIN="${2:-}"
      shift 2
      ;;
    --api-domain)
      API_DOMAIN="${2:-}"
      shift 2
      ;;
    --database-url)
      DATABASE_URL="${2:-}"
      shift 2
      ;;
    --jwt-secret)
      JWT_SECRET="${2:-}"
      shift 2
      ;;
    --enable-ai-copilot)
      ENABLE_AI_COPILOT="${2:-}"
      shift 2
      ;;
    --ai-provider)
      AI_PROVIDER="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ -z "${WEB_DOMAIN}" || -z "${API_DOMAIN}" || -z "${DATABASE_URL}" ]]; then
  echo "ERROR: --web-domain, --api-domain, --database-url are required." >&2
  usage
  exit 1
fi

if [[ "${ENABLE_AI_COPILOT}" != "true" && "${ENABLE_AI_COPILOT}" != "false" ]]; then
  echo "ERROR: --enable-ai-copilot must be true or false." >&2
  exit 1
fi

if [[ "${AI_PROVIDER}" != "glm45" && "${AI_PROVIDER}" != "openai" ]]; then
  echo "ERROR: --ai-provider must be glm45 or openai." >&2
  exit 1
fi

WEB_ORIGIN="$(normalize_url "${WEB_DOMAIN}")"
API_ORIGIN="$(normalize_url "${API_DOMAIN}")"
API_HOST="$(extract_host "${API_ORIGIN}")"

if [[ -z "${JWT_SECRET}" ]]; then
  JWT_SECRET="$(generate_secret)"
fi

if [[ ${#JWT_SECRET} -lt 32 ]]; then
  echo "ERROR: JWT secret must be at least 32 characters." >&2
  exit 1
fi

if [[ ! "${DATABASE_URL}" =~ sslmode=require ]]; then
  echo "WARN: DATABASE_URL does not include 'sslmode=require'. Neon typically requires SSL." >&2
fi

cat > "${SERVER_ENV_PATH}" <<EOF
ENVIRONMENT=production
LOG_LEVEL=INFO

DATABASE_URL=${DATABASE_URL}

JWT_SECRET=${JWT_SECRET}
AUTH_COOKIE_SECURE=true
AUTH_COOKIE_SAMESITE=none
AUTH_COOKIE_DOMAIN=
ENABLE_API_DOCS=false
MVP_TEST_LOGIN_ENABLED=false

TRUST_PROXY_HEADERS=true
CORS_ORIGINS=${WEB_ORIGIN}
TRUSTED_HOSTS=${API_HOST}

REDIS_URL=
REDIS_RATE_LIMIT_PREFIX=pcinsight:rl

ENABLE_AI_COPILOT=${ENABLE_AI_COPILOT}
AI_PROVIDER=${AI_PROVIDER}
OPENAI_API_KEY=
GLM_API_KEY=
OPENAI_MODEL=gpt-4o-mini
GLM_MODEL=glm-4.5
EOF

cat > "${WEB_ENV_PATH}" <<EOF
NEXT_PUBLIC_API_BASE=${API_ORIGIN}
NEXT_PUBLIC_ENABLE_AI_COPILOT=${ENABLE_AI_COPILOT}
NEXT_PUBLIC_AI_PROVIDER=${AI_PROVIDER}
EOF

echo "Generated:"
echo "  - ${SERVER_ENV_PATH}"
echo "  - ${WEB_ENV_PATH}"
echo
echo "Next:"
echo "  1) Review secret values in ${SERVER_ENV_PATH}"
echo "  2) Run: scripts/check_production_env.sh"
echo "  3) Apply env vars to Render and web host"
