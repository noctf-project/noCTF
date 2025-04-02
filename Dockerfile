ARG NODE_VERSION=22-slim


FROM node:$NODE_VERSION AS build
ENV CI=1
ENV DOCKER_ENV=1
WORKDIR /build
RUN corepack enable pnpm
COPY pnpm-lock.yaml .
RUN pnpm fetch --config.ignore-scripts
COPY . .
RUN pnpm install -r --ignore-scripts --frozen-lockfile

RUN pnpm --filter '@noctf/server' build
RUN pnpm --filter '@noctf/web' build

RUN pnpm --filter=@noctf/server --prefer-offline --prod deploy /deploy/server

# create images
FROM node:$NODE_VERSION AS server
COPY --from=build /deploy/server /build/apps/server
ENV HOST=::
ENV ENABLE_SWAGGER=0
WORKDIR "/build/apps/server"
CMD ["node", "dist/www.cjs"]


FROM joseluisq/static-web-server AS web
COPY --from=build /build/apps/web/dist /public
COPY --from=build /build/apps/web/dist/404.html /public/index.html
EXPOSE 80/tcp