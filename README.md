noCTF
=====

Welcome to the noCTF monorepo. There's a lot of code here so you must be wondering on how to
get started.

## Getting Started
You can skip the rest of the sections for now, but I promise that it is a good read so that you
can understand how the app is laid out. Currently the docker-compose is only used to set up
dependencies such as PostgreSQL and Redis. The development applications will not be dockerised.

```
# Start the docker dependencides
./dev.sh start

# Run the database migrations
pnpm kysely migrate latest

# Build the database schemas
cd core/schema
pnpm build --env-file ../../.env
cd ../..

# Finally run the server
cd apps/server
pnpm dev
```

## Creating Database Migrations
You can run the below command to create a new migration file.

```
pnpm kysely migrate make <migration_name>
```

If you make changes to the database schema or migration files, you will need to re-run the schema builder in order to have the correct types for the database.

```
# from core/schema
pnpm build --env-file ../../.env
```

## Writing Plugins
A plugin is in essence a fastify plugin. Currently a automated plugin loader does not exist so you will have to modify `apps/server/package.json` to install your plugin, as well as `apps/server/core.ts` to load the code.

You can create new routes and access the exposed services by using `fastify.container`.

## Layout
All of the main containerisable packages will be located in `apps`. Each app should have a
Dockerfile (WIP) in order to build and launch the container.