import type { AwilixContainer } from "awilix";
import type { AuditLogService } from "./services/audit_log.ts";
import type { IdentityService } from "./services/identity.ts";
import type { DatabaseClient } from "./clients/database.ts";
import { RedisClientFactory } from "./clients/redis_factory.ts";
import type { ConfigService } from "./services/config.ts";
import type { TokenService } from "./services/token.ts";
import type { UserService } from "./services/user.ts";
import type { CacheService } from "./services/cache.ts";
import type { TeamService } from "./services/team.ts";
import type { Logger } from "./types/primitives.ts";
import { RoleService } from "./services/role.ts";
import { EventBusService } from "./services/event_bus.ts";

export type ServiceCradle = {
  logger: Logger;
  databaseClient: DatabaseClient;
  redisClientFactory: RedisClientFactory;
  auditLogService: AuditLogService;
  cacheService: CacheService;
  eventBusService: EventBusService;
  tokenService: TokenService;
  configService: ConfigService;
  identityService: IdentityService;
  roleService: RoleService;
  teamService: TeamService;
  userService: UserService;
};

declare module "fastify" {
  interface FastifyInstance {
    container: AwilixContainer<ServiceCradle>;
  }
}
