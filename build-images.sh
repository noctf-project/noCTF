#!/bin/bash
compose_project=noctf_build
tag_prefix=noctf
node_version=22-slim

build() {
  docker buildx build \
    --builder "$compose_project" \
    --progress "plain" \
    --build-arg "POSTGRES_URL=postgres://postgres:noctf@$postgres_host:5432/noctf" \
    --build-arg "NODE_VERSION=$node_version" \
    --target "$1" --tag "$tag_prefix/$1" --load  .
}

docker compose -p "$compose_project" -f docker-compose-build.yml up -d
postgres_host=`docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$compose_project-postgres-1"`
docker buildx create --name "$compose_project" --driver-opt "network=$compose_project"_default
build server
docker buildx rm "$compose_project"
docker compose -p "$compose_project" -f docker-compose-build.yml -v down