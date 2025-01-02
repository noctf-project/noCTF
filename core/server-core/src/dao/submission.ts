import type { DB } from "@noctf/schema";
import type { Insertable, Kysely } from "kysely";

export class SubmissionDAO {
  async create(db: Kysely<DB>, v: Insertable<DB["submission"]>) {
    await db.insertInto("submission").values(v).executeTakeFirst();
  }

  async getCurrentMetadata(
    db: Kysely<DB>,
    challenge_id: number,
    team_id: number,
  ) {
    return await db
      .selectFrom("submission")
      .select(["id", "user_id", "queued", "solved", "created_at"])
      .where("challenge_id", "=", challenge_id)
      .where("team_id", "=", team_id)
      .where((eb) => eb.or([eb("queued", "=", true), eb("solved", "=", true)]))
      .executeTakeFirst();
  }
}
