import { ForbiddenError } from "../errors.ts";
import { ServiceCradle } from "../index.ts";
import { Evaluate, Policy } from "../util/policy.ts";

type Props = Pick<ServiceCradle, "auditLogService" | "cacheClient" | "databaseClient">;


export const CACHE_NAMESPACE = "core:svc:role";

export enum StaticRole {
  PUBLIC = "public",
  USER = "user",
  ADMIN = "admin"
}

export class RoleService {
  private readonly auditLogService: Props["auditLogService"];
  private readonly cacheClient: Props["cacheClient"];
  private readonly databaseClient: Props["databaseClient"];

  private staticRoleIds: Record<StaticRole, number> = null;

  constructor({ auditLogService, cacheClient, databaseClient }: Props) {
    this.auditLogService = auditLogService;
    this.cacheClient = cacheClient;
    this.databaseClient = databaseClient;
  }

  async getPermissions(id: number) {
    return this.cacheClient.load(
      `${CACHE_NAMESPACE}:permission:${id}`,
      async () =>
        (
          await this.databaseClient.selectFrom("core.role")
          .select("permissions")
          .where("id", "=", id)
          .executeTakeFirstOrThrow()
        ).permissions,
    );
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
    this.staticRoleIds = results.reduce((prev, cur) => {
      prev[cur.name as StaticRole] = cur.id;
      return prev;
    }, {} as RoleService["staticRoleIds"]);
    return this.staticRoleIds;
  }

  async evaluate(policy: Policy, roleIds: number[]) {
    try {
      return await Promise.any(roleIds.map(async (id) => {
        const permissions = await this.getPermissions(id);
        return Evaluate(policy, permissions) ? Promise.resolve(id)
          : Promise.reject(id);
      }));
    } catch {
      throw new ForbiddenError("Access denied by role policies");
    }
  }
}