#!/usr/bin/env bash
set -euo pipefail

# Generate a unique project name so concurrent or sequential runs never clash
RUN_ID="${RANDOM:-$$}"
PROJECT_NAME="noctf-integ-${RUN_ID}"
COMPOSE_FILE="docker-compose.integ.yml"

echo "==> Starting integration containers (project: ${PROJECT_NAME})..."
COMPOSE="docker compose -p ${PROJECT_NAME} -f ${COMPOSE_FILE}"

cleanup() {
  echo "==> Tearing down integration containers..."
  $COMPOSE down -v --remove-orphans > /dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

# 1. Start all containers in background
$COMPOSE up -d

# 2. Wait for postgres to be ready
echo "==> Waiting for postgres to accept connections..."
until $COMPOSE exec -T postgres pg_isready -U postgres > /dev/null 2>&1; do
  sleep 0.2
done
echo "==> Postgres is ready."

# 3. Discover dynamic ports
PG_PORT=$($COMPOSE port postgres 5432 | sed 's/.*://')
REDIS_PORT=$($COMPOSE port redis 6379 | sed 's/.*://')
NATS_PORT=$($COMPOSE port nats 4222 | sed 's/.*://')

export POSTGRES_URL="postgres://postgres:noctf@127.0.0.1:${PG_PORT}/noctf"
export REDIS_URL="redis://127.0.0.1:${REDIS_PORT}"
export NATS_URL="nats://127.0.0.1:${NATS_PORT}"

echo "==> Services available at:"
echo "    PostgreSQL: ${POSTGRES_URL}"
echo "    Redis:      ${REDIS_URL}"
echo "    NATS:       ${NATS_URL}"

# 4. Run migrations
echo "==> Running migrations..."
pnpm --filter @noctf/migrator migrate latest

echo "==> Infrastructure ready!"

# 5. Execute test command if supplied, otherwise run server-core integ tests
if [ $# -gt 0 ]; then
  echo "==> Running tests: $*"
  "$@"
else
  echo "==> Running integration tests across server-core..."
  pnpm --filter @noctf/server-core test:integ --run
fi
