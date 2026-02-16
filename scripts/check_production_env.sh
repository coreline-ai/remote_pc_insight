#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER_ENV_PATH="${ROOT_DIR}/server/.env.production"
WEB_ENV_PATH="${ROOT_DIR}/web/.env.production"

err() {
  echo "ERROR: $*" >&2
  exit 1
}

warn() {
  echo "WARN: $*" >&2
}

require_file() {
  local path="$1"
  [[ -f "${path}" ]] || err "Missing file: ${path}"
}

read_env_value() {
  local path="$1"
  local key="$2"
  local line
  line="$(grep -E "^${key}=" "${path}" | tail -n 1 || true)"
  printf "%s" "${line#*=}"
}

contains_placeholder() {
  local value="$1"
  [[ "${value}" == *"<"* || "${value}" == *">"* ]]
}

require_non_empty_key() {
  local path="$1"
  local key="$2"
  local value
  value="$(read_env_value "${path}" "${key}")"
  [[ -n "${value}" ]] || err "${key} is empty in ${path}"
  contains_placeholder "${value}" && err "${key} still contains placeholder in ${path}"
}

extract_host() {
  local url="$1"
  local no_scheme="${url#http://}"
  no_scheme="${no_scheme#https://}"
  printf "%s" "${no_scheme%%/*}"
}

require_file "${SERVER_ENV_PATH}"
require_file "${WEB_ENV_PATH}"

require_non_empty_key "${SERVER_ENV_PATH}" "ENVIRONMENT"
require_non_empty_key "${SERVER_ENV_PATH}" "DATABASE_URL"
require_non_empty_key "${SERVER_ENV_PATH}" "JWT_SECRET"
require_non_empty_key "${SERVER_ENV_PATH}" "CORS_ORIGINS"
require_non_empty_key "${SERVER_ENV_PATH}" "TRUSTED_HOSTS"
require_non_empty_key "${WEB_ENV_PATH}" "NEXT_PUBLIC_API_BASE"

ENVIRONMENT_VALUE="$(read_env_value "${SERVER_ENV_PATH}" "ENVIRONMENT")"
[[ "${ENVIRONMENT_VALUE}" == "production" ]] || warn "ENVIRONMENT is '${ENVIRONMENT_VALUE}', expected 'production'"

JWT_SECRET_VALUE="$(read_env_value "${SERVER_ENV_PATH}" "JWT_SECRET")"
[[ ${#JWT_SECRET_VALUE} -ge 32 ]] || err "JWT_SECRET must be at least 32 characters"

AUTH_COOKIE_SECURE_VALUE="$(read_env_value "${SERVER_ENV_PATH}" "AUTH_COOKIE_SECURE")"
[[ "${AUTH_COOKIE_SECURE_VALUE}" == "true" ]] || err "AUTH_COOKIE_SECURE must be true"

ENABLE_API_DOCS_VALUE="$(read_env_value "${SERVER_ENV_PATH}" "ENABLE_API_DOCS")"
[[ "${ENABLE_API_DOCS_VALUE}" == "false" ]] || err "ENABLE_API_DOCS must be false"

MVP_TEST_LOGIN_ENABLED_VALUE="$(read_env_value "${SERVER_ENV_PATH}" "MVP_TEST_LOGIN_ENABLED")"
[[ "${MVP_TEST_LOGIN_ENABLED_VALUE}" == "false" ]] || err "MVP_TEST_LOGIN_ENABLED must be false"

DATABASE_URL_VALUE="$(read_env_value "${SERVER_ENV_PATH}" "DATABASE_URL")"
[[ "${DATABASE_URL_VALUE}" == *"sslmode=require"* ]] || warn "DATABASE_URL does not include sslmode=require"

WEB_API_BASE="$(read_env_value "${WEB_ENV_PATH}" "NEXT_PUBLIC_API_BASE")"
[[ "${WEB_API_BASE}" =~ ^https?:// ]] || err "NEXT_PUBLIC_API_BASE must start with http:// or https://"
API_HOST="$(extract_host "${WEB_API_BASE}")"

TRUSTED_HOSTS_VALUE="$(read_env_value "${SERVER_ENV_PATH}" "TRUSTED_HOSTS")"
if [[ "${TRUSTED_HOSTS_VALUE}" != *"${API_HOST}"* ]]; then
  warn "TRUSTED_HOSTS does not appear to include API host '${API_HOST}'"
fi

CORS_ORIGINS_VALUE="$(read_env_value "${SERVER_ENV_PATH}" "CORS_ORIGINS")"
if [[ "${CORS_ORIGINS_VALUE}" != *"http"* ]]; then
  warn "CORS_ORIGINS does not look like URL origin(s): ${CORS_ORIGINS_VALUE}"
fi

echo "OK: production env preflight checks passed."
echo "  - ${SERVER_ENV_PATH}"
echo "  - ${WEB_ENV_PATH}"
