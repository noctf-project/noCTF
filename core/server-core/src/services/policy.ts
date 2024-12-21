import { PolicyDAO } from "../dao/policy.ts";
import type { ServiceCradle } from "../index.ts";
import type { Policy } from "../util/policy.ts";
import { Evaluate } from "../util/policy.ts";

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

export class PolicyService {
  private readonly auditLogService;
  private readonly cacheService;
  private readonly databaseClient;
  private readonly policyDAO;

  constructor({
    auditLogService,
    cacheService: cacheService,
    databaseClient,
  }: Props) {
    this.auditLogService = auditLogService;
    this.cacheService = cacheService;
    this.databaseClient = databaseClient;
    this.policyDAO = new PolicyDAO();
  }

  async getPermissionsForUser(userId: number) {
    return this.cacheService.load(
      CACHE_NAMESPACE,
      `rbac:user:${userId}`,
      () =>
        this.policyDAO.getPermissionsForUser(this.databaseClient.get(), userId),
      {
        expireSeconds: 10,
      },
    );
  }

  async getPermissionsForPublic() {
    return this.cacheService.load(
      CACHE_NAMESPACE,
      `rbac:public`,
      () => this.policyDAO.getPermissionsForPublic(this.databaseClient.get()),
      {
        expireSeconds: 10,
      },
    );
  }

  async evaluate(userId: number | null, policy: Policy) {
    const roles = await (userId
      ? this.getPermissionsForUser(userId)
      : this.getPermissionsForPublic());
    for (const { permissions } of roles) {
      if (Evaluate(policy, permissions)) return true;
    }
    return false;
  }
}
