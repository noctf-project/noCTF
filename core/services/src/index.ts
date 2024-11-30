import { AwilixContainer } from "awilix";
import { IdentityService } from "./identity";
import { DatabaseService } from "./database";
import { FastifyBaseLogger, FastifyInstance } from "fastify";
import { ConfigService } from "./config";
import { TokenService } from "./token";
import { UserService } from "./user";

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
