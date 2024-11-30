import fastify from "fastify";
import { DATABASE_URL, HOST, PORT, TOKEN_SECRET } from "./config.ts";
import core from "./core.ts";
import { Service } from "@noctf/server-core";
import { asFunction, asValue, createContainer, Lifetime } from "awilix";
import { IdentityService } from "@noctf/server-core/services/identity";
import { ConfigService } from "@noctf/server-core/services/config";
import { DatabaseService } from "@noctf/server-core/services/database";
import { UserService } from "@noctf/server-core/services/user";
import { TokenService } from "@noctf/server-core/services/token";
import { ApplicationError } from "@noctf/server-core/errors";

const server: Service = fastify({
  logger: true,
}) as unknown as Service;

server.register(async () => {
  server.container = createContainer();
  server.container.register({
    logger: asValue(server.log),
    tokenService: asValue(new TokenService(TOKEN_SECRET)),
    identityService: asFunction(
      ({ databaseService, tokenService }) =>
        new IdentityService(databaseService, tokenService),
      {
        lifetime: Lifetime.SINGLETON,
      },
    ),
    configService: asFunction(
      ({ logger, databaseService }) =>
        new ConfigService(logger, databaseService),
      { lifetime: Lifetime.SINGLETON },
    ),
    databaseService: asFunction(() => new DatabaseService(DATABASE_URL), {
      lifetime: Lifetime.SINGLETON,
    }),
    userService: asFunction(
      ({ databaseService }) => new UserService(databaseService),
      { lifetime: Lifetime.SINGLETON },
    ),
  });
});

server.register(core);

server.setErrorHandler((error, request, reply) => {
  if (error instanceof ApplicationError) {
    reply
      .status(error.status)
      .send({ error: error.code, message: error.message });
    return;
  }
  if (error.validation) {
    const messages = error.validation.map(
      ({ instancePath, message }) => `${instancePath.substring(1)} ${message}`,
    );
    reply
      .status(400)
      .send({ error: "ValidationError", message: messages.join("; ") });
    return;
  }
  server.log.error("request threw unexpected error: %s", error.stack);
  reply
    .status(500)
    .send({ error: "InternalServerError", message: "Internal Server Error" });
});

server.listen(
  {
    port: PORT,
    host: HOST,
  },
  (err) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
  },
);
