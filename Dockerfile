ARG NODE_VERSION=24-slim


# use a staging image to cache dependencies better
FROM node:$NODE_VERSION AS staging
COPY . .
RUN mkdir -p /staging && \
    cp package.json pnpm-lock.yaml pnpm-workspace.yaml /staging/ && \
    find apps core plugins -name "package.json" -exec sh -c 'mkdir -p /staging/$(dirname {}) && cp {} /staging/{}' \;

FROM node:$NODE_VERSION AS base
ENV CI=1
ENV DOCKER_ENV=1
WORKDIR /build
RUN corepack enable pnpm
COPY --from=staging /staging/ .
RUN pnpm install -r --ignore-scripts --frozen-lockfile
COPY . .

# create images
FROM base AS build_server
RUN pnpm --filter '@noctf/server' build
RUN pnpm --filter=@noctf/server --prefer-offline --prod deploy /deploy/server
FROM node:$NODE_VERSION AS out_server
COPY --from=build_server /deploy/server /build/apps/server
ENV HOST=::
ENV ENABLE_SWAGGER=0
WORKDIR "/build/apps/server"
USER 1000
CMD ["node", "dist/www.cjs"]

FROM base AS build_web
RUN VITE_API_BASE_URL="___REPLACEME_NOCTF_API_BASE_URL___" pnpm --filter '@noctf/web' build

FROM joseluisq/static-web-server:2-alpine AS out_web
COPY --from=build_web /build/apps/web/docker-init /init
COPY --from=build_web /build/apps/web/dist /public
COPY --from=build_web /build/apps/web/dist/index.html /public/index.html
EXPOSE 80/tcp
ENTRYPOINT [ "/init/setup.sh" ]
CMD [ "static-web-server" ]