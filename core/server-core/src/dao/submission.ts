import type { DB } from "@noctf/schema";
import type { Insertable } from "kysely";
import { DBType } from "../clients/database.ts";

export class SubmissionDAO {
  constructor(private readonly db: DBType) {}

  async create(v: Insertable<DB["submission"]>) {
    await this.db.insertInto("submission").values(v).executeTakeFirst();
  }

  async getCurrentMetadata(challenge_id: number, team_id: number) {
    return await this.db
      .selectFrom("submission")
      .select(["id", "user_id", "status", "created_at"])
      .where("challenge_id", "=", challenge_id)
      .where("team_id", "=", team_id)
      .where("status", "in", ["correct", "queued"])
      .executeTakeFirst();
  }
}
