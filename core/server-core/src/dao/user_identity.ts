import pg from "pg";
import { DB } from "@noctf/schema";
import { Insertable, Kysely } from "kysely";
import { ConflictError } from "../errors.ts";

export class UserIdentityDAO {
  async create(
    db: Kysely<DB>,
    {
      user_id,
      provider,
      provider_id,
      secret_data,
    }: Insertable<DB["core.user_identity"]>,
  ) {
    try {
      await db
        .insertInto("core.user_identity")
        .values({ user_id, provider, provider_id, secret_data })
        .execute();
    } catch (e) {
      if (e instanceof pg.DatabaseError && e.constraint) {
        throw new ConflictError(
          `A provider with type ${provider} already exists`,
        );
      }
    }
  }
}
