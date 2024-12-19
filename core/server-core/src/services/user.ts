import { BadRequestError, ConflictError } from "../errors.ts";
import { ServiceCradle } from "../index.ts";
import { AuditLogActor } from "../types/audit_log.ts";
import { ActorType } from "../types/enums.ts";
import { UserDAO } from "../dao/user.ts";
import { UserIdentityDAO } from "../dao/user_identity.ts";
import { AssociateIdentity } from "./identity.ts";

type Props = Pick<
  ServiceCradle,
  "databaseClient" | "cacheService" | "auditLogService"
>;

export const CACHE_NAMESPACE = "core:svc:user";

export class UserService {
  private readonly databaseClient;
  private readonly auditLogService;

  private readonly userDAO;
  private readonly userIdentityDAO;

  constructor({ databaseClient, auditLogService }: Props) {
    this.databaseClient = databaseClient;
    this.auditLogService = auditLogService;

    this.userDAO = new UserDAO();
    this.userIdentityDAO = new UserIdentityDAO();
  }

  async update(
    id: number,
    {
      name,
      bio,
      roles,
    }: {
      name: string;
      bio: string;
      roles: string[];
    },
    actor?: AuditLogActor,
  ) {
    await this.userDAO.update(this.databaseClient.get(), id, {
      name,
      bio,
      roles,
    });
    const changed = [name && "name", bio && "bio", roles && "roles"].filter(
      (x) => x,
    );

    await this.auditLogService.log({
      operation: "user.update",
      actor: actor || {
        type: ActorType.SYSTEM,
      },
      entities: [`${ActorType.USER}:${id}`],
      data: `Properties ${changed.join(", ")} were updated.`,
    });
  }

  async create(
    {
      name,
      identities,
      roles,
    }: {
      name: string;
      identities: AssociateIdentity[];
      roles?: string[];
    },
    actor?: AuditLogActor,
  ) {
    if (!identities || !identities.length) {
      throw new BadRequestError(
        "NoIdentitiesForUserError",
        "Cannot create a user with no identities",
      );
    }

    if (await this.userDAO.checkNameExists(this.databaseClient.get(), name)) {
      throw new ConflictError("A user already exists with this name");
    }

    const id = await this.databaseClient.transaction(async (tx) => {
      const id = await this.userDAO.create(tx, { name, roles });
      for (const identity of identities) {
        await this.userIdentityDAO.associate(tx, { ...identity, user_id: id });
      }

      return id;
    });
    await this.auditLogService.log({
      operation: "user.create",
      actor: actor || {
        type: ActorType.USER,
        id: id,
      },
      entities: [`${ActorType.USER}:${id}`],
    });
    return id;
  }
}
