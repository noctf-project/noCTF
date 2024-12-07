import type { AwilixContainer } from "awilix";
import type { AuditLogService } from "./services/audit_log.ts";
import type { IdentityService } from "./services/identity.ts";
import type { DatabaseClient } from "./clients/database.ts";
import type { ConfigService } from "./services/config.ts";
import type { TokenService } from "./services/token.ts";
import type { UserService } from "./services/user.ts";
import type { CacheClient } from "./clients/cache.ts";
import type { TeamService } from "./services/team.ts";
import type { Logger } from "./types/primitives.ts";
import { RoleService } from "./services/role.ts";

export type ServiceCradle = {
  logger: Logger;
  auditLogService: AuditLogService;
  cacheClient: CacheClient;
  databaseClient: DatabaseClient;
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
