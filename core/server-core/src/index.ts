import { AwilixContainer } from "awilix";
import { IdentityService } from "./services/identity.ts";
import { DatabaseClient } from "./clients/database.ts";
import { FastifyBaseLogger, FastifyInstance } from "fastify";
import { ConfigService } from "./services/config.ts";
import { TokenService } from "./services/token.ts";
import { UserService } from "./services/user.ts";

export interface ServiceCradle {
  logger: FastifyBaseLogger;
  databaseClient: DatabaseClient;
  tokenService: TokenService;
  configService: ConfigService;
  identityService: IdentityService;
  userService: UserService;
}

export interface Service extends FastifyInstance {
  container: AwilixContainer<ServiceCradle>;
}
