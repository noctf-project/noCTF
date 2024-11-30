#!/bin/bash
PROJECT_NAME=noctf_dev

get-ip() {
  docker inspect "$PROJECT_NAME-$1-1" \
    --format '{{ (index .NetworkSettings.Networks "'$PROJECT_NAME'_default").IPAddress }}'
}

start() {
  docker-compose -p "${PROJECT_NAME}" up -d

  cat << EOF > .env
DATABASE_URL="postgres://postgres:noctf@`get-ip postgres`/noctf"
REDIS_URL="redis://`get-ip redis`"
EOF
  echo "Started $PROJECT_NAME"
}

stop() {
  docker-compose -p "${PROJECT_NAME}" stop
  rm .env
  echo "Stopped $PROJECT_NAME"
}

clean() {
  docker-compose -p "${PROJECT_NAME}" down -v
  docker-compose -p "${PROJECT_NAME}" rm -f -v
  rm .env
  echo "Cleaned $PROJECT_NAME"
}

case $1 in
  start)
    start
    ;;

  stop)
    stop
    ;;
  
  clean)
    clean
    ;;

  *)
    echo -n "Unknown command. Supported commands are start, stop, clean"
    ;;
esac