import { UpdateIdentityData } from "../providers/identity.ts";
import { DatabaseService } from "./database.ts";
import { ApplicationError, BadRequestError } from "../errors.ts";

export class UserService {
  constructor(private databaseService: DatabaseService) {}

  async create(
    name: string,
    identities: UpdateIdentityData[],
    groups?: string[],
  ) {
    if (!identities || !identities.length) {
      throw new BadRequestError(
        "NoIdentitiesForUserError",
        "Cannot create a user with no identities",
      );
    }

    // Do an invariant check, validate that identities don't already exist
    try {
      const result = await Promise.any(
        identities.map(({ provider, provider_id }) =>
          this.databaseService
            .selectFrom("core.user_identity")
            .select(["user_id"])
            .where("provider", "=", provider)
            .where("provider_id", "=", provider_id)
            .executeTakeFirst()
            .then((identity) => {
              if (!identity) {
                return Promise.reject("not exists");
              }
              return true;
            }),
        ),
      );
      if (result) {
        throw new ApplicationError(
          409,
          "IdentityAlreadyExists",
          "The identity is already bound to a different user",
        );
      }
    } catch (e) {
      if (!(e instanceof AggregateError)) {
        throw e;
      }
    }

    return await this.databaseService.transaction().execute(async (tx) => {
      const { id } = await tx
        .insertInto("core.user")
        .values({
          name,
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

      if (groups) {
        await tx
          .insertInto("core.user_group")
          .values((eb) =>
            groups.map((name) => ({
              user_id: id,
              group_id: eb
                .selectFrom("core.group")
                .select("id")
                .where("name", "=", name),
            })),
          )
          .execute();
      }

      return id;
    });
  }
}
