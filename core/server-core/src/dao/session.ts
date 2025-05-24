import { DB } from "@noctf/schema";
import { DBType } from "../clients/database.ts";
import { Insertable, sql } from "kysely";
import { NotFoundError } from "../errors.ts";

export class SessionDAO {
  constructor(private readonly db: DBType) {}

  async createSession({
    user_id,
    app_id,
    refresh_token_hash,
    expires_at,
    scopes,
  }: Pick<
    Insertable<DB["session"]>,
    "user_id" | "app_id" | "refresh_token_hash" | "expires_at" | "scopes"
  >) {
    return (
      await this.db
        .insertInto("session")
        .values({
          user_id,
          app_id,
          refresh_token_hash,
          expires_at,
          scopes,
        })
        .returning("id")
        .executeTakeFirstOrThrow()
    ).id;
  }

  async getByRefreshToken(hash: Buffer) {
    const result = await this.db
      .selectFrom("session")
      .where("refresh_token_hash", "=", hash)
      .select(["id", "user_id", "expires_at", "revoked_at", "scopes"])
      .executeTakeFirst();
    if (!result) {
      throw new NotFoundError("Refresh token not found");
    }
    return result;
  }

  async refreshSession(
    app_id: number | null,
    oldTokenHash: Buffer,
    newTokenHash: Buffer,
  ) {
    return await this.db
      .updateTable("session")
      .set("refresh_token_hash", newTokenHash)
      .where("refresh_token_hash", "=", oldTokenHash)
      .where("app_id", "=", app_id)
      .where("expires_at", ">", sql<Date>`CURRENT_TIMESTAMP`)
      .where("revoked_at", ">", sql<Date>`CURRENT_TIMESTAMP`)
      .returning(["id", "user_id", "expires_at", "revoked_at", "scopes"])
      .executeTakeFirstOrThrow();
  }

  async revokeSession(id: number) {
    await this.db
      .updateTable("session")
      .set({
        revoked_at: new Date(),
        refresh_token_hash: null,
      })
      .where("id", "=", id)
      .where("revoked_at", "is", null)
      .executeTakeFirstOrThrow();
  }

  async revokeUserSessions(user_id: number, app_id: number | null = null) {
    await this.db
      .updateTable("session")
      .set({
        revoked_at: new Date(),
      })
      .where("user_id", "=", user_id)
      .where("app_id", app_id === null ? "is" : "=", app_id)
      .where("revoked_at", "is", null)
      .execute();
  }
}
