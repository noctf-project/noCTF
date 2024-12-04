import { UpdateIdentityData } from "../types/identity.ts";
import { DatabaseClient } from "../clients/database.ts";
import { ApplicationError, BadRequestError } from "../errors.ts";
import { ServiceCradle } from "../index.ts";
import { CacheClient } from "../clients/cache.ts";

type Props = Pick<ServiceCradle, "databaseClient" | "cacheClient">;

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
  private cacheClient: CacheClient;

  constructor({ databaseClient, cacheClient }: Props) {
    this.databaseClient = databaseClient;
    this.cacheClient = cacheClient;
  }

  async getFlags(id: number) {
    return this.cacheClient.load(
      `${CACHE_NAMESPACE}:${id}:flag`,
      async () =>
        (
          await this.databaseClient
            .selectFrom("core.user")
            .select("flags")
            .where("id", "=", id)
            .executeTakeFirst()
        ).flags,
    );
  }

  async create(
    name: string,
    identities: UpdateIdentityData[],
    flags?: string[],
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

      return id;
    });
  }
}
