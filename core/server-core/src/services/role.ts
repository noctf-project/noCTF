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

  async getPermissions(roleId: number) {
    return this.cacheService.load(
      `${CACHE_NAMESPACE}:permission:${roleId}`,
      async () =>
        (
          await this.databaseClient
            .selectFrom("core.role")
            .select("permissions")
            .where("id", "=", roleId)
            .executeTakeFirstOrThrow()
        ).permissions,
    );
  }

  async getUserRoleIds(userId: number) {
    return this.cacheService.load(
      `${CACHE_NAMESPACE}:user:${userId}`,
      async () =>
        (
          await this.databaseClient
            .selectFrom("core.user_role")
            .select("role_id")
            .where("user_id", "=", userId)
            .execute()
        ).map(({ role_id }) => role_id),
      {
        expireSeconds: 10,
      },
    );
  }

  async addMember(
    roleId: number,
    userId: number,
    { actor, message }: AuditParams = {},
  ) {
    await this.databaseClient
      .insertInto("core.user_role")
      .values({
        role_id: roleId,
        user_id: userId,
      })
      .execute();
    await this.auditLogService.log({
      operation: "role.member.add",
      actor: actor || { type: ActorType.SYSTEM },
      entities: [`${ActorType.ROLE}:${roleId}`, `${ActorType.USER}:${userId}`],
      data: message,
    });
  }

  async removeMember(
    roleId: number,
    userId: number,
    { actor, message }: AuditParams = {},
  ) {
    const { numDeletedRows } = await this.databaseClient
      .deleteFrom("core.user_role")
      .where("role_id", "=", roleId)
      .where("user_id", "=", userId)
      .executeTakeFirst();
    if (numDeletedRows) {
      await this.auditLogService.log({
        operation: "role.member.remove",
        actor: actor || { type: ActorType.SYSTEM },
        entities: [
          `${ActorType.ROLE}:${roleId}`,
          `${ActorType.USER}:${userId}`,
        ],
        data: message,
      });
    }
  }

  async getStaticRoleIds() {
    if (this.staticRoleIds) {
      return this.staticRoleIds;
    }
    const results = await this.databaseClient
      .selectFrom("core.role")
      .select(["name", "id"])
      .where("name", "in", ["public", "user", "admin"])
      .execute();
    this.staticRoleIds = results.reduce(
      (prev, cur) => {
        prev[cur.name as StaticRole] = cur.id;
        return prev;
      },
      {} as RoleService["staticRoleIds"],
    );
    return this.staticRoleIds;
  }

  async evaluate(roleId: number, policy: Policy) {
    const permissions = await this.getPermissions(roleId);
    return Evaluate(policy, permissions);
  }
}
