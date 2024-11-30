import { AwilixContainer } from "awilix";
import { IdentityService } from "./identity.ts";
import { DatabaseService } from "./database.ts";
import { FastifyBaseLogger, FastifyInstance } from "fastify";
import { ConfigService } from "./config.ts";
import { TokenService } from "./token.ts";
import { UserService } from "./user.ts";

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
