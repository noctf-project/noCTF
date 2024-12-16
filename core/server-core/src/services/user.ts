import { UpdateIdentityData } from "../types/identity.ts";
import { DatabaseClient } from "../clients/database.ts";
import { BadRequestError, ConflictError } from "../errors.ts";
import { ServiceCradle } from "../index.ts";
import { CacheService } from "./cache.ts";
import { AuditLogService } from "./audit_log.ts";
import { AuditLogActor } from "../types/audit_log.ts";
import { ActorType } from "../types/enums.ts";

type Props = Pick<
  ServiceCradle,
  "databaseClient" | "cacheService" | "auditLogService"
>;

export const CACHE_NAMESPACE = "core:svc:user";

const checkCount =
  (provider: string) =>
  ({ count }: { count: string | number }) => {
    if (count === 0 || count === "0") {
      return Promise.reject("not exists");
    }
    return provider;
  };

export class UserService {
  private databaseClient: DatabaseClient;
  private cacheService: CacheService;
  private auditLogService: AuditLogService;

  constructor({
    databaseClient,
    cacheService: cacheService,
    auditLogService,
  }: Props) {
    this.databaseClient = databaseClient;
    this.cacheService = cacheService;
    this.auditLogService = auditLogService;
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
    const r = await this.databaseClient
      .updateTable("core.user")
      .set({
        name,
        bio,
        roles,
      })
      .where("id", "=", id)
      .executeTakeFirstOrThrow();

    const changed = [
      name && 'name',
      bio && 'bio',
      roles && 'roles'
    ].filter((x) => x);

    await this.auditLogService.log({
      operation: "user.update",
      actor: actor || {
        type: ActorType.USER,
        id: id,
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
      identities: UpdateIdentityData[];
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

    // Do an invariant check, validate that identities don't already exist
    try {
      const promises = identities.map(({ provider, provider_id }) =>
        this.databaseClient
          .selectFrom("core.user_identity")
          .select((q) => q.fn.countAll<number>().as("count"))
          .where("provider", "=", provider)
          .where("provider_id", "=", provider_id)
          .executeTakeFirst()
          .then(checkCount(provider)),
      );
      const result = await Promise.any(
        [
          this.databaseClient
            .selectFrom("core.user")
            .select(this.databaseClient.fn.countAll().as("count"))
            .where("name", "=", name)
            .executeTakeFirst()
            .then(checkCount("name")),
        ].concat(promises),
      );
      if (result) {
        throw new ConflictError(
          `The identity with type ${result} is already bound to a different user`,
        );
      }
    } catch (e) {
      if (!(e instanceof AggregateError)) {
        throw e;
      }
    }

    return await this.databaseClient.transaction().execute(async (tx) => {
      const { id } = await tx
        .insertInto("core.user")
        .values({
          name,
          roles: roles || [],
        })
        .returning("id")
        .executeTakeFirstOrThrow();

      const insertedIdentities = identities.map((identity) => ({
        ...identity,
        user_id: id,
      }));
      await tx
        .insertInto("core.user_identity")
        .values(insertedIdentities)
        .execute();

      await this.auditLogService.log({
        operation: "user.create",
        actor: actor || {
          type: ActorType.USER,
          id: id,
        },
        entities: [`${ActorType.USER}:${id}`],
      });

      return id;
    });
  }
}
