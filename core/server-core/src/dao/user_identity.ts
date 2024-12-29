import pg from "pg";
import { ConflictError } from "../errors.ts";
import type { DBType } from "../clients/database.ts";
import type { UserIdentity } from "@noctf/api/datatypes";

export class UserIdentityDAO {
  async associate(
    db: DBType,
    {
      user_id,
      provider,
      provider_id,
      secret_data,
    }: Omit<UserIdentity, "created_at">,
  ) {
    try {
      await db
        .insertInto("user_identity")
        .values({ user_id, provider, provider_id, secret_data })
        .onConflict((oc) =>
          oc.columns(["user_id", "provider"]).doUpdateSet({
            provider,
            provider_id,
            secret_data,
          }),
        )
        .execute();
    } catch (e) {
      if (e instanceof pg.DatabaseError && e.constraint) {
        throw new ConflictError(
          `A provider with type ${provider} already exists`,
        );
      }
    }
  }

  async disAssociate(
    db: DBType,
    { user_id, provider }: Pick<UserIdentity, "user_id" | "provider">,
  ) {
    return await db
      .deleteFrom("user_identity")
      .where("user_id", "=", user_id)
      .where("provider", "=", provider)
      .executeTakeFirst();
  }

  async listProvidersForUser(db: DBType, user_id: number) {
    return await db
      .selectFrom("user_identity")
      .select(["provider", "provider_id"])
      .where("user_id", "=", user_id)
      .execute();
  }

  async getIdentityForUser(
    db: DBType,
    { user_id, provider }: Pick<UserIdentity, "user_id" | "provider">,
  ) {
    return this.selectIdentity(db)
      .where("user_id", "=", user_id)
      .where("provider", "=", provider)
      .executeTakeFirst();
  }

  async getIdentityForProvider(
    db: DBType,
    { provider, provider_id }: Pick<UserIdentity, "provider" | "provider_id">,
  ) {
    return this.selectIdentity(db)
      .where("provider", "=", provider)
      .where("provider_id", "=", provider_id)
      .executeTakeFirst();
  }

  private selectIdentity(db: DBType) {
    return db
      .selectFrom("user_identity")
      .select([
        "user_id",
        "provider",
        "provider_id",
        "secret_data",
        "created_at",
      ]);
  }
}
