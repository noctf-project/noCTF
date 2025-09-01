import { PolicyDAO } from "../dao/policy.ts";
import type { ServiceCradle } from "../index.ts";
import type { Policy } from "../util/policy.ts";
import {
  Evaluate,
  EvaluatePrefixes,
  PreprocessPermissions,
} from "../util/policy.ts";
import { LocalCache } from "../util/local_cache.ts";
import { UserDAO } from "../dao/user.ts";
import { AuthConfig } from "@noctf/api/config";
import { EntityType, UserFlag, UserRole } from "../types/enums.ts";
import SingleValueCache from "../util/single_value_cache.ts";
import { AuditParams } from "../types/audit_log.ts";
import { PolicyUpdateEvent } from "@noctf/api/events";

type Props = Pick<
  ServiceCradle,
  | "databaseClient"
  | "logger"
  | "configService"
  | "auditLogService"
  | "eventBusService"
>;

export const CACHE_NAMESPACE = "core:svc:policy";

const USER_ROLES_EXPIRATION = 15000;
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
    ttl: USER_ROLES_EXPIRATION,
  });
  private readonly policyGetter = new SingleValueCache(
    async () =>
      (await this.policyDAO.list({ is_enabled: true })).map((x) => ({
        ...x,
        permissions: PreprocessPermissions(x.permissions),
      })),
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
    void this.subscribeUpdates();
  }

  /**
   * Listen for config update messages
   */
  private async subscribeUpdates() {
    await this.eventBusService.subscribe<PolicyUpdateEvent>(
      new AbortController().signal,
      undefined,
      [PolicyUpdateEvent.$id!],
      {
        concurrency: 1,
        handler: async () => {
          // TODO: do a little more sophisticated parsing
          this.policyGetter.clear();
        },
      },
    );
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
    await Promise.all([
      this.auditLogService.log({
        operation: "policy.create",
        actor,
        data: message,
        entities: [`${EntityType.POLICY}:${policy.id}`],
      }),
      this.eventBusService.publish(PolicyUpdateEvent, {
        type: "create",
        id: policy.id,
        name: policy.name,
        updated_at: policy.updated_at,
        version: policy.version,
      }),
    ]);
    return policy;
  }

  async update(
    id: number,
    v: Parameters<PolicyDAO["update"]>[1],
    { actor, message }: AuditParams = {},
  ) {
    const result = await this.policyDAO.update(id, v);
    this.policyGetter.clear();
    await Promise.all([
      this.auditLogService.log({
        operation: "policy.update",
        actor,
        data: message,
        entities: [`${EntityType.POLICY}:${id}`],
      }),
      this.eventBusService.publish(PolicyUpdateEvent, {
        type: "update",
        id: id,
        name: result.name,
        updated_at: result.updated_at,
        version: result.version,
      }),
    ]);
  }

  async delete(
    id: number,
    version?: number,
    { actor, message }: AuditParams = {},
  ) {
    const result = await this.policyDAO.delete(id, version);
    this.policyGetter.clear();
    await Promise.all([
      this.auditLogService.log({
        operation: "policy.delete",
        actor,
        data: message,
        entities: [`${EntityType.POLICY}:${id}`],
      }),
      this.eventBusService.publish(PolicyUpdateEvent, {
        type: "delete",
        id: id,
        name: result.name,
        updated_at: new Date(),
        version: result.version + 1,
      }),
    ]);
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
    for (const { permissions } of policies) {
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
