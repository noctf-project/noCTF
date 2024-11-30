import { AwilixContainer } from "awilix";
import { IdentityService } from "./services/identity.ts";
import { DatabaseService } from "./services/database.ts";
import { FastifyBaseLogger, FastifyInstance } from "fastify";
import { ConfigService } from "./services/config.ts";
import { TokenService } from "./services/token.ts";
import { UserService } from "./services/user.ts";

export interface ServiceCradle {
  logger: FastifyBaseLogger;
  tokenService: TokenService;
  identityService: IdentityService;
  userService: UserService;
  configService: ConfigService;
  databaseService: DatabaseService;
}

export interface Service extends FastifyInstance {
  container: AwilixContainer<ServiceCradle>;
}
