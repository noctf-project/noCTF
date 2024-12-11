import { UpdateIdentityData } from "../types/identity.ts";
import { DatabaseClient } from "../clients/database.ts";
import { ApplicationError, BadRequestError } from "../errors.ts";
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

  constructor({ databaseClient, cacheService: cacheService, auditLogService }: Props) {
    this.databaseClient = databaseClient;
    this.cacheService = cacheService;
    this.auditLogService = auditLogService;
  }

  async getFlags(id: number) {
    return this.cacheService.load(
      `${CACHE_NAMESPACE}:${id}:flag`,
      async () =>
        (
          await this.databaseClient
            .selectFrom("core.user")
            .select("flags")
            .where("id", "=", id)
            .executeTakeFirstOrThrow()
        ).flags,
    );
  }

  async create({
    name,
    identities,
    flags,
    actor,
  }: {
    name: string;
    identities: UpdateIdentityData[];
    flags?: string[];
    actor?: AuditLogActor;
  }) {
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
        throw new ApplicationError(
          409,
          "IdentityAlreadyExists",
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
          flags: flags || [],
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

      void this.auditLogService.log({
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
