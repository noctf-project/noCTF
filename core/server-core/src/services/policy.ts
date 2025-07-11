import { PolicyDAO } from "../dao/policy.ts";
import type { ServiceCradle } from "../index.ts";
import type { Policy } from "../util/policy.ts";
import { Evaluate, EvaluatePrefixes } from "../util/policy.ts";
import { LocalCache } from "../util/local_cache.ts";
import { UserDAO } from "../dao/user.ts";
import { AuthConfig } from "@noctf/api/config";
import { EntityType, UserFlag, UserRole } from "../types/enums.ts";
import SingleValueCache from "../util/single_value_cache.ts";
import { AuditParams } from "../types/audit_log.ts";

type Props = Pick<
  ServiceCradle,
  "databaseClient" | "logger" | "configService" | "auditLogService" | "policyService"
>;

export const CACHE_NAMESPACE = "core:svc:policy";

const POLICY_EXPIRATION = 60000;

export class PolicyService {
  private readonly logger;
  private readonly auditLogService;
  private readonly configService;
  private readonly eventBusService;

  private readonly policyDAO;
  private readonly userDAO;

  private readonly userRolesCache = new LocalCache<number, Set<string>>({
    max: 16384,
    ttl: POLICY_EXPIRATION,
  });
  private readonly policyGetter = new SingleValueCache(
    () => this.policyDAO.list({ is_enabled: true }),
    POLICY_EXPIRATION,
  );

  constructor({
    databaseClient,
    logger,
    configService,
    auditLogService,
    eventBusService,
  }: Props) {
    this.logger = logger;
    this.auditLogService = auditLogService;
    this.configService = configService;
    this.eventBusService = eventBusService;
    this.policyDAO = new PolicyDAO(databaseClient.get());
    this.userDAO = new UserDAO(databaseClient.get());
  }

  async list() {
    return this.policyDAO.list();
  }

  async create(
    v: Parameters<PolicyDAO["create"]>[0],
    { actor, message }: AuditParams = {},
  ) {
    const policy = await this.policyDAO.create(v);
    this.policyGetter.clear();
    await this.auditLogService.log({
      operation: "policy.create",
      actor,
      data: message,
      entities: [`${EntityType.POLICY}:${policy.id}`],
    });
    await this.eventBusService.
    return policy;
  }

  async update(
    id: number,
    v: Parameters<PolicyDAO["update"]>[1],
    { actor, message }: AuditParams = {},
  ) {
    await this.policyDAO.update(id, v);
    this.policyGetter.clear();
    await this.auditLogService.log({
      operation: "policy.update",
      actor,
      data: message,
      entities: [`${EntityType.POLICY}:${id}`],
    });
  }

  async delete(id: number, { actor, message }: AuditParams = {}) {
    await this.policyDAO.delete(id);
    this.policyGetter.clear();
    await this.auditLogService.log({
      operation: "policy.delete",
      actor,
      data: message,
      entities: [`${EntityType.POLICY}:${id}`],
    });
  }

  async getPoliciesForUser(userId: number) {
    const roleSet = await this.getRolesForUser(userId);
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

  async evaluatePrefixes(userId: number, prefixes: string[]) {
    const policies = await (userId
      ? this.getPoliciesForUser(userId)
      : this.getPoliciesForPublic());
    const set = new Set(prefixes);
    const pass: string[] = [];
    for (const { permissions, name } of policies) {
      const results = EvaluatePrefixes(set, permissions);
      Array.prototype.push.apply(pass, results);
    }
    return pass;
  }

  async getRolesForUser(id: number) {
    return await this.userRolesCache.load(id, () => this.fetchRolesForUser(id));
  }

  private async fetchRolesForUser(id: number): Promise<Set<string>> {
    const flagsAndRoles = await this.userDAO.getFlagsAndRoles(id);
    // User not found
    if (!flagsAndRoles) return new Set();
    return this.computeRolesForUser(flagsAndRoles);
  }

  async computeRolesForUser(p: {
    flags: string[];
    roles: string[];
    team_id: number | null;
  }) {
    const roleSet = new Set(p.roles);
    const isBlocked = p.flags.includes(UserFlag.BLOCKED);
    if (isBlocked) {
      roleSet.add(UserRole.BLOCKED);
    } else if (
      p.flags.includes(UserFlag.VALID_EMAIL) ||
      !(await this.configService.get(AuthConfig)).value.validate_email
    ) {
      roleSet.add(UserRole.ACTIVE);
    }
    if (p.team_id) {
      roleSet.add(UserRole.HAS_TEAM);
    }
    return roleSet;
  }
}
