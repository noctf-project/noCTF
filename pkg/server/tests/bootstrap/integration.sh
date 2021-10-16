#!/bin/bash

# Prevent conflicts with running app
POSTGRES_PORT=15432
REDIS_PORT=16379

export GIT_ROOT=`git rev-parse --show-toplevel`
export NOCTF_LOG_LEVEL=warn
export NOCTF_SECRETS_DIR="$GIT_ROOT/data/secrets-integ"
export NOCTF_DATABASE_CLIENT=postgresql
export NOCTF_DATABASE_CONNECTION_NAME=noctf
export NOCTF_DATABASE_CONNECTION_HOST=localhost
export NOCTF_DATABASE_CONNECTION_PORT="$POSTGRES_PORT"
export NOCTF_DATABASE_CONNECTION_USERNAME=noctf
export NOCTF_DATABASE_CONNECTION_PASSWORD=devpassword
export NOCTF_REDIS_URL="redis://127.0.0.1:$REDIS_PORT/"

echo "$PWD"
COMPOSE="
version: '3'

services:
    postgres:
        image: postgres
        ports: [ $POSTGRES_PORT:5432 ]
        environment:
            POSTGRES_USER: $NOCTF_DATABASE_CONNECTION_USERNAME
            POSTGRES_PASSWORD: $NOCTF_DATABASE_CONNECTION_PASSWORD
            POSTGRES_DB: $NOCTF_DATABASE_CONNECTION_NAME
    redis:
        image: redis
        ports: [ $REDIS_PORT:6379 ]
"

set -eu

trap 'echo "$COMPOSE" | docker-compose -f /dev/stdin down' EXIT

echo -e "=== SETUP ==="

echo "$COMPOSE" | docker-compose -f /dev/stdin up -d

knex migrate:up
ts-node dev-setup.ts

echo -e "\n=== TESTS ==="
REPORTER="${REPORTER:-faucet}"
tape -r ts-node/register "$@" | "$REPORTER"


echo -e "\n=== TEARDOWN ==="