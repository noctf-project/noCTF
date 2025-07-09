import type { AwilixContainer } from "awilix";
import type { AuditLogService } from "./services/audit_log.ts";
import type { IdentityService } from "./services/identity.ts";
import type { DatabaseClient } from "./clients/database.ts";
import type { RedisClientFactory } from "./clients/redis.ts";
import type { ConfigService } from "./services/config.ts";
import type { UserService } from "./services/user.ts";
import type { CacheService } from "./services/cache.ts";
import type { TeamService } from "./services/team.ts";
import type { Logger } from "./types/primitives.ts";
import type { PolicyService } from "./services/policy.ts";
import type { EventBusService } from "./services/event_bus.ts";
import type { LockService } from "./services/lock.ts";
import type { MetricsClient } from "./clients/metrics.ts";
import type { NATSClientFactory } from "./clients/nats.ts";
import type { ChallengeService } from "./services/challenge/index.ts";
import type { FileService } from "./services/file/index.ts";
import type { ScoreService } from "./services/score.ts";
import type { ScoreboardService } from "./services/scoreboard/index.ts";
import type { SubmissionService } from "./services/submission.ts";
import type { RateLimitService } from "./services/rate_limit.ts";
import type { EmailService } from "./services/email/index.ts";
import type { AppService } from "./services/app.ts";
import type { KeyService } from "./services/key.ts";
import type { DivisionService } from "./services/division.ts";
import type { TokenService } from "./services/token.ts";
import type { NotificationService } from "./services/notification.ts";

export type ServiceCradle = {
  logger: Logger;
  natsClientFactory: NATSClientFactory;
  databaseClient: DatabaseClient;
  metricsClient: MetricsClient;
  redisClientFactory: RedisClientFactory;
  appService: AppService;
  auditLogService: AuditLogService;
  cacheService: CacheService;
  challengeService: ChallengeService;
  emailService: EmailService;
  eventBusService: EventBusService;
  fileService: FileService;
  keyService: KeyService;
  configService: ConfigService;
  divisionService: DivisionService;
  identityService: IdentityService;
  policyService: PolicyService;
  rateLimitService: RateLimitService;
  notificationService: NotificationService;
  scoreService: ScoreService;
  scoreboardService: ScoreboardService;
  submissionService: SubmissionService;
  teamService: TeamService;
  tokenService: TokenService;
  userService: UserService;
  lockService: LockService;
};

declare module "fastify" {
  interface FastifyInstance {
    container: AwilixContainer<ServiceCradle>;
  }
}
