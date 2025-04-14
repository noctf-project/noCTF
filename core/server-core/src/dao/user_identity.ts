import pg from "pg";
import { ConflictError } from "../errors.ts";
import type { DBType } from "../clients/database.ts";
import type { UserIdentity } from "@noctf/api/datatypes";

export class UserIdentityDAO {
  constructor(private readonly db: DBType) {}

  async associate({
    user_id,
    provider,
    provider_id,
    secret_data,
  }: Omit<UserIdentity, "created_at">) {
    try {
      await this.db
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

  async disAssociate({
    user_id,
    provider,
  }: Pick<UserIdentity, "user_id" | "provider">) {
    return await this.db
      .deleteFrom("user_identity")
      .where("user_id", "=", user_id)
      .where("provider", "=", provider)
      .executeTakeFirst();
  }

  async listProvidersForUser(user_id: number) {
    return await this.db
      .selectFrom("user_identity")
      .select(["provider", "provider_id"])
      .where("user_id", "=", user_id)
      .execute();
  }

  async getIdentityForUser(user_id: number, provider: string) {
    return this.selectIdentity()
      .where("user_id", "=", user_id)
      .where("provider", "=", provider)
      .executeTakeFirst();
  }

  async getIdentityForProvider({
    provider,
    provider_id,
  }: Pick<UserIdentity, "provider" | "provider_id">) {
    return this.selectIdentity()
      .where("provider", "=", provider)
      .where("provider_id", "=", provider_id)
      .executeTakeFirst();
  }

  private selectIdentity() {
    return this.db
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
