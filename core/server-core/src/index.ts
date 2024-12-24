import type { AwilixContainer } from "awilix";
import type { AuditLogService } from "./services/audit_log.ts";
import type { IdentityService } from "./services/identity.ts";
import type { DatabaseClient } from "./clients/database.ts";
import type { RedisClientFactory } from "./clients/redis.ts";
import type { ConfigService } from "./services/config.ts";
import type { TokenService } from "./services/token.ts";
import type { UserService } from "./services/user.ts";
import type { CacheService } from "./services/cache.ts";
import type { TeamService } from "./services/team.ts";
import type { Logger } from "./types/primitives.ts";
import type { PolicyService } from "./services/policy.ts";
import type { EventBusService } from "./services/event_bus.ts";
import type { LockService } from "./services/lock.ts";
import type { MetricsClient } from "./clients/metrics.ts";
import type { NATSClientFactory } from "./clients/nats.ts";
import type { ChallengeService } from "./services/challenge.ts";
import type { FileService } from "./services/file.ts";

export type ServiceCradle = {
  logger: Logger;
  natsClientFactory: NATSClientFactory;
  databaseClient: DatabaseClient;
  metricsClient: MetricsClient;
  redisClientFactory: RedisClientFactory;
  auditLogService: AuditLogService;
  cacheService: CacheService;
  challengeService: ChallengeService;
  eventBusService: EventBusService;
  fileService: FileService;
  tokenService: TokenService;
  configService: ConfigService;
  identityService: IdentityService;
  policyService: PolicyService;
  teamService: TeamService;
  userService: UserService;
  lockService: LockService;
};

declare module "fastify" {
  interface FastifyInstance {
    container: AwilixContainer<ServiceCradle>;
  }
}
