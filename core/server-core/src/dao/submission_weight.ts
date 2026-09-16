import { DB } from "@noctf/schema";
import { DBType } from "../clients/database.ts";
import { Insertable } from "kysely";

export class SubmissionWeightDAO {
  constructor(private readonly db: DBType) {}

  async create(v: Insertable<DB["submission_weight"]>[]) {
    return await this.db.insertInto("submission_weight").values(v).execute();
  }

  async listAll(challenge_id: number, team_id?: number) {
    let query = this.db
      .selectFrom("submission_weight")
      .select(["challenge_id", "team_id", "weight", "created_at"])
      .where("challenge_id", "=", challenge_id)
      .orderBy("created_at", "asc");
    if (team_id) {
      query = query.where("team_id", "=", team_id);
    }
    return query.execute();
  }

  async listLatest(challenge_id: number, team_id?: number[]) {
    let query = this.db
      .selectFrom("submission_weight")
      .select(["challenge_id", "team_id", "weight", "created_at"])
      .distinctOn(["challenge_id", "team_id"])
      .where("challenge_id", "=", challenge_id);

    if (team_id) {
      query = query.where("team_id", "in", team_id);
    }

    return await query
      .orderBy("challenge_id")
      .orderBy("team_id")
      .orderBy("created_at", "desc")
      .execute();
  }
}
