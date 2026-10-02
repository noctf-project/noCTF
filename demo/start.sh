#!/usr/bin/env bash

# Starts the demo stack at https://api.demo.noctf.dev.

set -euo pipefail

DEMO_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd -- "$DEMO_DIR/.." && pwd)"
DEMO_COMPOSE="$DEMO_DIR/docker-compose.yml"
DEMO_COMPOSE_URL="${DEMO_COMPOSE_URL:-https://raw.githubusercontent.com/noctf-project/noctf/master/docker-compose.yml}"
PROJECT_DIR="$ROOT_DIR"
TEMP_BASE_COMPOSE=""
PREBUILT_IMAGES=0

for command in docker openssl; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Required command not found: $command" >&2
    exit 1
  fi
done

if ! docker compose version >/dev/null 2>&1; then
  echo "Required command not found: docker compose (Compose plugin)" >&2
  exit 1
fi

if [ -f "$ROOT_DIR/docker-compose.yml" ]; then
  BASE_COMPOSE="$ROOT_DIR/docker-compose.yml"
else
  if ! command -v curl >/dev/null 2>&1; then
    echo "Required command not found: curl" >&2
    exit 1
  fi
  TEMP_BASE_COMPOSE="$(mktemp)"
  BASE_COMPOSE="$TEMP_BASE_COMPOSE"
  PROJECT_DIR="$DEMO_DIR"
  PREBUILT_IMAGES=1
fi

DEMO_DOMAIN="${DEMO_DOMAIN:-demo.noctf.dev}"
DEMO_API_PORT="${DEMO_API_PORT:-8000}"
DEMO_API_BASE_URL="${DEMO_API_BASE_URL:-https://api-demo.noctf.dev}"
DEMO_ROOT_URL="${DEMO_ROOT_URL:-https://${DEMO_DOMAIN}}"
DEMO_TOKEN_SECRET="$(openssl rand -hex 32)"

export DEMO_DIR DEMO_DOMAIN DEMO_API_PORT DEMO_API_BASE_URL DEMO_ROOT_URL DEMO_TOKEN_SECRET

COMPOSE=(
  docker compose
  --project-directory "$PROJECT_DIR"
  -p noctf-demo
  -f "$BASE_COMPOSE"
  -f "$DEMO_COMPOSE"
)
API_URL="http://127.0.0.1:${DEMO_API_PORT}"
LOG_PID=""

cleanup() {
  trap - EXIT INT TERM
  if [[ -n "$LOG_PID" ]]; then
    kill "$LOG_PID" 2>/dev/null || true
    wait "$LOG_PID" 2>/dev/null || true
  fi
  "${COMPOSE[@]}" down --timeout 0 || true
  if [[ -n "$TEMP_BASE_COMPOSE" ]]; then
    rm -f "$TEMP_BASE_COMPOSE"
  fi
}

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

if [[ "$PREBUILT_IMAGES" == 1 ]]; then
  echo "Fetching base Compose file from $DEMO_COMPOSE_URL"
  curl --fail --location --silent --show-error "$DEMO_COMPOSE_URL" --output "$BASE_COMPOSE"
fi

if [[ "$PREBUILT_IMAGES" == 1 ]]; then
  # The standalone runtime has no source checkout, so use published images only.
  "${COMPOSE[@]}" up -d --pull always --no-build
else
  # From a checkout, let Compose build from the local source when needed.
  "${COMPOSE[@]}" up -d
fi

"${COMPOSE[@]}" wait seeder
SEEDER_ID=$("${COMPOSE[@]}" ps -aq seeder)
if [[ -z "$SEEDER_ID" ]]; then
  echo "Seeder container was not created." >&2
  exit 1
fi
SEEDER_EXIT_CODE=$(docker inspect --format '{{.State.ExitCode}}' "$SEEDER_ID")
if [[ "$SEEDER_EXIT_CODE" != 0 ]]; then
  "${COMPOSE[@]}" logs seeder
  exit "$SEEDER_EXIT_CODE"
fi

echo "Following demo logs. Send SIGTERM or press Ctrl-C to stop and remove the demo stack."
"${COMPOSE[@]}" logs --follow --no-color server worker migrator postgres redis nats &
LOG_PID=$!
wait "$LOG_PID"
