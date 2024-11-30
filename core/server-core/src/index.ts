import { AwilixContainer } from "awilix";
import { IdentityService } from "./services/identity.ts";
import { DatabaseClient } from "./clients/database.ts";
import { FastifyBaseLogger, FastifyInstance } from "fastify";
import { ConfigService } from "./services/config.ts";
import { TokenService } from "./services/token.ts";
import { UserService } from "./services/user.ts";
import { CacheClient } from "./clients/cache.ts";
import { TeamService } from "./services/team.ts";

export type ServiceCradle = {
  logger: FastifyBaseLogger;
  cacheClient: CacheClient;
  databaseClient: DatabaseClient;
  tokenService: TokenService;
  configService: ConfigService;
  identityService: IdentityService;
  teamService: TeamService;
  userService: UserService;
};

export interface Service extends FastifyInstance {
  container: AwilixContainer<ServiceCradle>;
}
