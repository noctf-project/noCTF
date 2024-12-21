ARG NODE_VERSION=22-slim

FROM node:$NODE_VERSION AS build
ARG POSTGRES_URL
ARG DROP_DATABASE=1

WORKDIR /build
RUN corepack enable pnpm
COPY pnpm-lock.yaml .
RUN pnpm fetch --config.ignore-scripts
COPY . .
RUN pnpm install -r --offline --ignore-scripts --frozen-lockfile
RUN node create-database.mjs
RUN pnpm exec kysely migrate latest
RUN pnpm --filter '@noctf/*' release

# create images
RUN pnpm --filter=@noctf/server --prefer-offline --prod deploy /deploy/server
FROM node:$NODE_VERSION AS server
COPY --from=build /deploy/server /build
ENV HOST=::
ENV ENABLE_SWAGGER=0
WORKDIR "/build"
CMD ["/build/dist/index.cjs"]
