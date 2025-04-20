import { PolicyDAO } from "../dao/policy.ts";
import type { ServiceCradle } from "../index.ts";
import type { Policy } from "../util/policy.ts";
import { Evaluate } from "../util/policy.ts";
import { LocalCache } from "../util/local_cache.ts";
import { UserDAO } from "../dao/user.ts";
import { AuthConfig } from "@noctf/api/config";
import { UserFlag, UserRole } from "../types/enums.ts";
import SingleValueCache from "../util/single_value_cache.ts";

type Props = Pick<ServiceCradle, "databaseClient" | "logger" | "configService">;

export const CACHE_NAMESPACE = "core:svc:policy";

export enum StaticRole {
  PUBLIC = "public",
  USER = "user",
  ADMIN = "admin",
}

const POLICY_EXPIRATION = 5000;
export class PolicyService {
  private readonly logger;
  private readonly configService;

  private readonly policyDAO;
  private readonly userDAO;

  private readonly userRolesCache = new LocalCache<number, Set<string>>({
    max: 16384,
    ttl: POLICY_EXPIRATION,
  });
  private readonly policyGetter = new SingleValueCache(
    () => this.policyDAO.listPolicies({ is_enabled: true }),
    3000,
  );

  constructor({ databaseClient, logger, configService }: Props) {
    this.logger = logger;
    this.configService = configService;
    this.policyDAO = new PolicyDAO(databaseClient.get());
    this.userDAO = new UserDAO(databaseClient.get());
  }

  async getPoliciesForUser(userId: number) {
    const roleSet = await this.userRolesCache.load(userId, () =>
      this.fetchRolesForUser(userId),
    );
    const policies = await this.policyGetter.get();
    const result = policies.filter(({ match_roles, omit_roles }) => {
      const omit = omit_roles.find((r) => roleSet.has(r)) !== undefined;
      const match =
        match_roles.length === 0 ||
        match_roles.find((r) => roleSet.has(r)) !== undefined;
      return !omit && match;
    });
    return result;
  }

  async getPoliciesForPublic() {
    const policies = await this.policyGetter.get();
    return policies.filter(({ public: isPublic }) => isPublic);
  }

  private async fetchRolesForUser(id: number): Promise<Set<string>> {
    const data = await this.userDAO.getFlagsAndRoles(id);
    if (!data) return new Set();
    const roleSet = new Set(data.roles);
    const isBlocked = data.flags.includes(UserFlag.BLOCKED);
    if (
      !isBlocked &&
      (data.flags.includes(UserFlag.VALID_EMAIL) ||
        !(await this.configService.get<AuthConfig>(AuthConfig.$id!)).value
          .validate_email)
    ) {
      roleSet.add(UserRole.ACTIVE);
    }
    return roleSet;
  }

  async evaluate(userId: number, policy: Policy) {
    const policies = await (userId
      ? this.getPoliciesForUser(userId)
      : this.getPoliciesForPublic());
    for (const { permissions, name } of policies) {
      const result = Evaluate(policy, permissions);
      this.logger.debug(
        { policy_name: name, result },
        "Policy evaluation result",
      );
      if (result) return true;
    }
    return false;
  }
}
