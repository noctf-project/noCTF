import { ConflictError } from "../errors.ts";
import type { DBType } from "../clients/database.ts";
import type { UserIdentity } from "@noctf/api/datatypes";
import { sql } from "kysely";
import {
  PostgresErrorCode,
  PostgresErrorConfig,
  TryPGConstraintError,
} from "../util/pgerror.ts";

const ASSOCIATE_ERROR_CONFIG: PostgresErrorConfig = {
  [PostgresErrorCode.Duplicate]: {
    default: (e) =>
      new ConflictError("Provider ID is associated to another account", {
        cause: e,
      }),
  },
};

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
            updated_at: sql`CURRENT_TIMESTAMP`,
          }),
        )
        .execute();
    } catch (e) {
      const pgerror = TryPGConstraintError(e, ASSOCIATE_ERROR_CONFIG);
      if (pgerror) throw pgerror;
      throw e;
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

  async listProvidersForUser(
    ids: number[],
    withSecret: true,
  ): Promise<UserIdentity[]>;
  async listProvidersForUser(
    ids: number[],
    withSecret?: false | undefined,
  ): Promise<Omit<UserIdentity, "secret_data">[]>;
  async listProvidersForUser(ids: number[], withSecret?: boolean) {
    let query = this.db.selectFrom("user_identity").where("user_id", "in", ids);
    if (withSecret) {
      return query
        .select([
          "user_id",
          "provider",
          "provider_id",
          "secret_data",
          "created_at",
        ])
        .execute();
    }
    return query
      .select(["user_id", "provider", "provider_id", "created_at"])
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
        "updated_at",
      ]);
  }
}
