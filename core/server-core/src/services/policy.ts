import { PolicyDAO } from "../dao/policy.ts";
import type { ServiceCradle } from "../index.ts";
import type { Policy } from "../util/policy.ts";
import { Evaluate } from "../util/policy.ts";
import { LocalCache } from "../util/local_cache.ts";
import { UserDAO } from "../dao/user.ts";
import { AuthConfig } from "@noctf/api/config";
import { UserRole } from "../types/enums.ts";

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

  private readonly userRolesCache = new LocalCache<number, string[]>({
    max: 16384,
    ttl: POLICY_EXPIRATION,
  });

  // Smallish table so we can cache the entirety of it
  private policyCache: Awaited<ReturnType<PolicyDAO["listPolicies"]>> | null =
    null;
  private policyCacheLastUpdated: number | null = null;

  constructor({ databaseClient, logger, configService }: Props) {
    this.logger = logger;
    this.configService = configService;
    this.policyDAO = new PolicyDAO(databaseClient.get());
    this.userDAO = new UserDAO(databaseClient.get());
  }

  async getPoliciesForUser(userId: number) {
    const [roles, policies] = await Promise.all([
      this.userRolesCache.load(userId, () => this.userDAO.getRoles(userId)),
      this.getEnabledPolicies(),
    ]);
    const roleSet = new Set(roles);
    const isBlocked = roleSet.has(UserRole.BLOCKED);
    if (
      !isBlocked &&
      (roleSet.has(UserRole.VALID_EMAIL) ||
        !(await this.configService.get<AuthConfig>(AuthConfig.$id!)).value
          .validate_email)
    ) {
      roleSet.add(UserRole.ACTIVE);
    }

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
    const policies = await this.getEnabledPolicies();
    return policies.filter(({ public: isPublic }) => isPublic);
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

  private async getEnabledPolicies() {
    if (!this.policyCache) {
      this.logger.debug("Loading initial policy cache");
      this.policyCache = await this.policyDAO.listPolicies({ enabled: true });
      this.policyCacheLastUpdated = performance.now();
    }
    if (
      this.policyCacheLastUpdated !== null &&
      this.policyCacheLastUpdated + POLICY_EXPIRATION <= performance.now()
    ) {
      this.logger.debug("Refreshing policy cache");
      this.policyCacheLastUpdated = null;
      this.policyDAO
        .listPolicies({ enabled: true })
        .then((p) => {
          this.policyCache = p;
          this.policyCacheLastUpdated = performance.now();
        })
        .catch((e) => {
          this.policyCacheLastUpdated = 0;
          this.logger.warn(
            e,
            "Failed to fetch an updated policy, continuing with stale version",
          );
        });
    }
    return this.policyCache;
  }
}
