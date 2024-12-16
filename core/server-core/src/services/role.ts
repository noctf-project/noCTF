import { ServiceCradle } from "../index.ts";
import { AuditParams } from "../types/audit_log.ts";
import { ActorType } from "../types/enums.ts";
import { Evaluate, Policy } from "../util/policy.ts";

type Props = Pick<
  ServiceCradle,
  "auditLogService" | "cacheService" | "databaseClient"
>;

export const CACHE_NAMESPACE = "core:svc:role";

export enum StaticRole {
  PUBLIC = "public",
  USER = "user",
  ADMIN = "admin",
}

export class RoleService {
  private readonly auditLogService: Props["auditLogService"];
  private readonly cacheService: Props["cacheService"];
  private readonly databaseClient: Props["databaseClient"];

  private staticRoleIds: Record<StaticRole, number> = null;

  constructor({
    auditLogService,
    cacheService: cacheService,
    databaseClient,
  }: Props) {
    this.auditLogService = auditLogService;
    this.cacheService = cacheService;
    this.databaseClient = databaseClient;
  }

  async getPermissionsForUser(userId: number) {
    return this.cacheService.load(
      CACHE_NAMESPACE,
      `rbac:user:${userId}`,
      async () => await this.databaseClient
        .selectFrom("core.role")
        .select(["core.role.id", "core.role.permissions"])
        .innerJoin('core.user', (join) => join.on((eb) => eb.and([
          eb.or([
            eb('core.role.match_flags', '=', '{}' as unknown as string[]),
            eb('core.role.match_flags', '&&', eb.ref('core.user.flags'))
          ]),
          eb.not(eb('core.user.flags', '&&', eb.ref('core.role.omit_flags')))
        ])))
        .where("core.user.id", "=", userId)
        .execute(),
      {
        expireSeconds: 10,
      },
    );
  }

  async getPermissionsPublic() {
    return this.cacheService.load(
      CACHE_NAMESPACE,
      `rbac:public`,
      async () => await this.databaseClient
        .selectFrom("core.role")
        .select(["id", "permissions"])
        .where("public", "=", true)
        .execute(),
      {
        expireSeconds: 10,
      },
    );
  }

  async evaluate(userId: number | null, policy: Policy) {
    const roles = await (userId
      ? this.getPermissionsForUser(userId)
      : this.getPermissionsPublic());
    for (const { permissions } of roles) {
      if (Evaluate(policy, permissions)) return true;
    }
    return false;
  }
}
