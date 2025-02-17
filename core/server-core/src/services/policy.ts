import { PolicyDAO } from "../dao/policy.ts";
import type { ServiceCradle } from "../index.ts";
import type { Policy } from "../util/policy.ts";
import { Evaluate } from "../util/policy.ts";

type Props = Pick<
  ServiceCradle,
  "auditLogService" | "cacheService" | "databaseClient"
>;

export const CACHE_NAMESPACE = "core:svc:policy";

export enum StaticRole {
  PUBLIC = "public",
  USER = "user",
  ADMIN = "admin",
}

export class PolicyService {
  private readonly cacheService;
  private readonly policyDAO;

  constructor({ cacheService: cacheService, databaseClient }: Props) {
    this.cacheService = cacheService;
    this.policyDAO = new PolicyDAO(databaseClient.get());
  }

  async getPermissionsForUser(userId: number) {
    return this.cacheService.load(
      CACHE_NAMESPACE,
      `user:${userId}`,
      () => this.policyDAO.getPermissionsForUser(userId),
      {
        expireSeconds: 10,
      },
    );
  }

  async getPermissionsForPublic() {
    return this.cacheService.load(
      CACHE_NAMESPACE,
      `public`,
      () => this.policyDAO.getPermissionsForPublic(),
      {
        expireSeconds: 10,
      },
    );
  }

  async evaluate(userId: number, policy: Policy) {
    const roles = await (userId
      ? this.getPermissionsForUser(userId)
      : this.getPermissionsForPublic());
    for (const { permissions } of roles) {
      if (Evaluate(policy, permissions)) return true;
    }
    return false;
  }
}
