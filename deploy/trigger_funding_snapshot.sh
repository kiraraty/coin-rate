#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCK_DIR="${SCRIPT_DIR}/.trigger_funding_snapshot.lock"
ENV_FILE="${SCRIPT_DIR}/trigger_funding_snapshot.env"
LOG_PREFIX="[funding-snapshot-trigger]"

log() {
  printf '%s %s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "${LOG_PREFIX}" "$*"
}

cleanup() {
  rmdir "${LOCK_DIR}" 2>/dev/null || true
}

if ! mkdir "${LOCK_DIR}" 2>/dev/null; then
  log "another trigger is still running, skip"
  exit 0
fi

trap cleanup EXIT

if [[ -f "${ENV_FILE}" ]]; then
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
fi

PRODUCTION_URL="${PRODUCTION_URL:-}"
CRON_SECRET="${CRON_SECRET:-}"

DEFAULT_PROXY="http://127.0.0.1:7890"
HTTP_PROXY="${HTTP_PROXY:-${http_proxy:-}}"
HTTPS_PROXY="${HTTPS_PROXY:-${https_proxy:-}}"
ALL_PROXY="${ALL_PROXY:-${all_proxy:-}}"

if [[ -z "${HTTP_PROXY}" && -z "${HTTPS_PROXY}" && -z "${ALL_PROXY}" ]]; then
  export HTTP_PROXY="${DEFAULT_PROXY}"
  export HTTPS_PROXY="${DEFAULT_PROXY}"
  export ALL_PROXY="${DEFAULT_PROXY}"
fi

export HTTP_PROXY="${HTTP_PROXY:-}"
export HTTPS_PROXY="${HTTPS_PROXY:-}"
export ALL_PROXY="${ALL_PROXY:-}"

if [[ -z "${PRODUCTION_URL}" ]]; then
  log "PRODUCTION_URL is missing"
  exit 1
fi

if [[ -z "${CRON_SECRET}" ]]; then
  log "CRON_SECRET is missing"
  exit 1
fi

case "${PRODUCTION_URL}" in
  http://*|https://*) ;;
  *)
    log "PRODUCTION_URL must start with http:// or https://"
    exit 1
    ;;
esac

BASE_URL="${PRODUCTION_URL%/}"
API_URL="${BASE_URL}/api/funding-snapshot"

log "requesting ${API_URL}"

RESPONSE="$(
  curl --silent --show-error --fail \
    --connect-timeout 10 \
    --max-time 60 \
    --retry 2 \
    --retry-delay 5 \
    --retry-all-errors \
    -H "Authorization: Bearer ${CRON_SECRET}" \
    -H "User-Agent: coin-rate-server-cron/1.0" \
    "${API_URL}"
)"

log "success ${RESPONSE}"
