import { DB } from "@noctf/schema";
import { DBType } from "../clients/database.ts";
import { Insertable, sql } from "kysely";
import { NotFoundError } from "../errors.ts";

const LISTABLE_FIELDS = [
  "id",
  "ip",
  "app_id",
  "user_id",
  "created_at",
  "refreshed_at",
  "expires_at",
  "revoked_at",
  "scopes",
] as const;

export class SessionDAO {
  constructor(private readonly db: DBType) {}

  async createSession({
    user_id,
    app_id,
    refresh_token_hash,
    expires_at,
    ip,
    scopes,
  }: Pick<
    Insertable<DB["session"]>,
    "user_id" | "app_id" | "refresh_token_hash" | "expires_at" | "scopes" | "ip"
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
          ip,
        })
        .returning("id")
        .executeTakeFirstOrThrow()
    ).id;
  }

  async getByRefreshToken(hash: Buffer) {
    const result = await this.db
      .selectFrom("session")
      .where("refresh_token_hash", "=", hash)
      .select(LISTABLE_FIELDS)
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
    return await this.db
      .updateTable("session")
      .set({
        revoked_at: new Date(),
      })
      .where("user_id", "=", user_id)
      .where("app_id", app_id === null ? "is" : "=", app_id)
      .where((eb) =>
        eb.or([
          eb("expires_at", "is", null),
          eb("expires_at", ">", sql<Date>`CURRENT_TIMESTAMP`),
        ]),
      )
      .where("revoked_at", "is", null)
      .returning(["id", "expires_at"])
      .execute();
  }

  async listByUserId(
    user_id: number,
    active?: boolean,
    limit?: { limit?: number; offset?: number },
  ) {
    let query = this.db
      .selectFrom("session")
      .select(LISTABLE_FIELDS)
      .where("user_id", "=", user_id)
      .orderBy("created_at", "desc");

    if (active) {
      query = query
        .where("revoked_at", "is", null)
        .where("expires_at", ">", sql<Date>`CURRENT_TIMESTAMP`);
    } else if (active === false) {
      query = query.where((eb) =>
        eb.or([
          eb("revoked_at", "is not", null),
          eb("expires_at", "<", sql<Date>`CURRENT_TIMESTAMP`),
        ]),
      );
    }

    if (limit?.limit) {
      query = query.limit(limit.limit);
    }
    if (limit?.offset) {
      query = query.offset(limit.offset);
    }
    return query.execute();
  }
}
