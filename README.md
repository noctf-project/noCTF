noCTF
=====

Welcome to the noCTF monorepo. There's a lot of code here so you must be wondering on how to
get started.

## Getting Started
You can skip the rest of the sections for now, but I promise that it is a good read so that you
can understand how the app is laid out. Currently the docker-compose is only used to set up
dependencies such as PostgreSQL and Redis. The development applications will not be dockerised.

**NOTE:** You will need to have node >=22.0 installed as we rely on `fs.glob()`

TIP: You can run `./dev-tmux.sh` which automates all the below steps (requires tmux).

```sh
# Install the dependencies
pnpm i

# Start the docker dependencies (postgresql, redis, nats)
# For linux based dev environments (connects to containers by IP)
./dev.sh start
# For non-linux based (connects to containers by localhost ports)
./dev.sh start-local

# Run the database migrations
pnpm kysely migrate latest

# Build the database schemas
cd core/schema
pnpm build --env-file ../../.env
cd ../..

# Generate the API schema file
cd apps/server
mkdir dist/
pnpm generate:swagger
cd ../..

# Build the API client
cd core/openapi-spec
pnpm build
cd ../..

# Finally run the server
cd apps/server
pnpm dev:www # api server
pnpm dev:worker # required in a separate tab for scoreboard calculations

# And the frontend
cd apps/web
pnpm dev
```

### Shutting down
Close all running processes, and then run the dev stop script

```sh
./dev.sh stop
```

## Creating Database Migrations
You can run the below command to create a new migration file.

```sh
pnpm kysely migrate make <migration_name>
```

If you make changes to the database schema or migration files, you will need to re-run the schema builder in order to have the correct types for the database.

```sh
# from core/schema
pnpm build --env-file ../../.env
```

## Writing Plugins
A plugin is in essence a fastify plugin. Currently a automated plugin loader does not exist so you will have to modify `apps/server/package.json` to install your plugin, as well as `apps/server/core.ts` to load the code.

You can create new routes and access the exposed services by using `fastify.container`.

## Layout
All of the main containerisable packages will be located in `apps`. Each app should have a
Dockerfile (WIP) in order to build and launch the container.



## License
All code in noCTF is licensed under the [Apache 2.0](https://www.apache.org/licenses/LICENSE-2.0)
license meaning that you are free to modify the code any way you wish, and use it for both personal
and commercial purposes, in line with the terms of the license.

That being said, we kindly ask that you do not use noCTF as the basis for a commercial
CTF-as-a-service platform i.e. services that host CTFs on behalf of third parties for profit (such
as commercial training platforms or resold event infrastructure).

This is a non-binding request, and we acknowledge that the Apache 2.0 license permits such usage.
However, we hope that users will respect the intent of the project: to support the broader CTF
community and educational institutions.

Examples of usage that aligns with the spirit of this project include:
- Community or student-run CTF competitions
- Private and open-to-public corporate CTF events
- Events hosted by educational institutions
- Private or nonprofit CTFs run within an organization or team

If you're unsure whether your use case aligns with this intent, feel free to reach out via GitHub
for clarification.