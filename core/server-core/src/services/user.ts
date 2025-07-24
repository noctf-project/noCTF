import { BadRequestError, ConflictError, NotFoundError } from "../errors.ts";
import type { ServiceCradle } from "../index.ts";
import type { AuditLogActor, AuditParams } from "../types/audit_log.ts";
import { ActorType } from "../types/enums.ts";
import { UserDAO } from "../dao/user.ts";
import { UserIdentityDAO } from "../dao/user_identity.ts";
import type { AssociateIdentity } from "./identity.ts";

type Props = Pick<
  ServiceCradle,
  "databaseClient" | "cacheService" | "auditLogService"
>;

export const CACHE_NAMESPACE = "core:svc:user";

export class UserService {
  private readonly databaseClient;
  private readonly auditLogService;

  private readonly userDAO;

  constructor({ databaseClient, auditLogService }: Props) {
    this.databaseClient = databaseClient;
    this.auditLogService = auditLogService;

    this.userDAO = new UserDAO(this.databaseClient.get());
  }

  async get(id: number) {
    const result = this.userDAO.get(id);
    if (!result) throw new NotFoundError("User not found");
    return result;
  }

  async listSummary(
    params?: {
      flags?: string[];
      roles?: string[];
      ids?: number[];
      name?: string;
    },
    limit?: { limit?: number; offset?: number },
  ) {
    return this.userDAO.listSummary(params, limit);
  }

  async getCount(params?: Parameters<UserDAO["listQuery"]>[0]) {
    return this.userDAO.getCount(params);
  }

  async update(
    id: number,
    {
      name,
      bio,
      flags,
      roles,
      country,
    }: {
      name?: string;
      bio?: string;
      flags?: string[];
      roles?: string[];
      country?: string | null;
    },
    { actor, message }: AuditParams = {},
  ) {
    await this.userDAO.update(id, {
      name,
      bio,
      flags,
      roles,
      country,
    });

    await this.auditLogService.log({
      operation: "user.update",
      actor,
      entities: [`${ActorType.USER}:${id}`],
      data: message,
    });
  }

  async create(
    {
      name,
      identities,
      roles,
      flags,
      country,
    }: {
      name: string;
      country?: string;
      identities: AssociateIdentity[];
      roles?: string[];
      flags?: string[];
    },
    { actor, message }: AuditParams = {},
  ) {
    if (!identities || !identities.length) {
      throw new BadRequestError(
        "NoIdentitiesForUserError",
        "Cannot create a user with no identities",
      );
    }

    if (await this.userDAO.getIdForName(name)) {
      throw new ConflictError("A user already exists with this name");
    }

    const id = await this.databaseClient.transaction(async (tx) => {
      const userDAO = new UserDAO(tx);
      const identityDAO = new UserIdentityDAO(tx);
      const id = await userDAO.create({ name, roles, flags, country });
      for (const identity of identities) {
        await identityDAO.associate({ ...identity, user_id: id });
      }

      return id;
    });
    await this.auditLogService.log({
      operation: "user.create",
      actor: actor || {
        type: ActorType.USER,
        id: id,
      },
      data: message,
      entities: [`${ActorType.USER}:${id}`],
    });
    return id;
  }

  async getIdForName(name: string) {
    return this.userDAO.getIdForName(name);
  }

  async delete(id: number, { actor, message }: AuditParams = {}) {
    await this.userDAO.delete(id);
    await this.auditLogService.log({
      actor,
      operation: "user.delete",
      entities: [`${ActorType.USER}:${id}`],
      data: message,
    });
  }
}
