import { DB } from "@noctf/schema";
import { DBType } from "../clients/database.ts";
import { Insertable, sql } from "kysely";
import { buildUnnest } from "./util.ts";

export class SubmissionWeightDAO {
  constructor(private readonly db: DBType) {}

  async create(v: Insertable<DB["submission_weight"]>[]) {
    if (!v.length) return;
    if (v.length === 1) {
      return await this.db.insertInto("submission_weight").values(v).execute();
    }

    const unnest = buildUnnest(v, {
      challenge_id: "integer",
      team_id: "integer",
      weight: "integer",
      created_at: {
        type: "timestamptz",
        default: sql`now()`,
        get: (entry) =>
          entry.created_at instanceof Date
            ? entry.created_at
            : typeof entry.created_at === "string"
              ? new Date(entry.created_at)
              : null,
      },
    });

    return await sql`
      INSERT INTO submission_weight (${unnest.columns})
      SELECT ${unnest.selectColumns}
      FROM ${unnest.source}
    `.execute(this.db);
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
