import { sql } from "kysely";
import { DBType } from "../clients/database.ts";
import { ScoreboardEntry } from "@noctf/api/datatypes";

export type HistoryDataPoint = Pick<
  ScoreboardEntry,
  "team_id" | "score" | "updated_at"
>;

// Postgres supports 65535 parameters
// since we are pushing 3 params per request roughly 20k requests will fit in a chunk
const ADD_CHUNK_SIZE = 20000;

export class ScoreHistoryDAO {
  constructor(private readonly db: DBType) {}

  async add(entries: { team_id: number; updated_at?: Date; score: number }[]) {
    if (!entries.length) return;
    for (let i = 0; i < entries.length; i += ADD_CHUNK_SIZE) {
      const values = entries
        .slice(i, i + ADD_CHUNK_SIZE)
        .map(({ team_id, score }) => ({
          team_id,
          score,
        }));
      await this.db
        .insertInto("score_history")
        .onConflict((o) =>
          o.columns(["team_id", "updated_at"]).doUpdateSet({
            score: (eb) => eb.ref("excluded.score"),
          }),
        )
        .execute();
    }
  }

  async flushAll() {
    await this.db.deleteFrom("score_history").execute();
  }

  async flushTeam(teamId: number) {
    await this.db
      .deleteFrom("score_history")
      .where("team_id", "=", teamId)
      .execute();
  }

  async listMostRecentByDivision(
    division: number,
  ): Promise<HistoryDataPoint[]> {
    return this.db
      .selectFrom("score_history as s")
      .select(["s.score", "s.team_id", "s.updated_at"])
      .distinctOn("s.team_id")
      .innerJoin("team as t", "s.team_id", "t.id")
      .where("t.division_id", "=", division)
      .orderBy("s.team_id", "desc")
      .orderBy("s.updated_at", "desc")
      .execute();
  }

  async getByTeams(teamId: number[], startTime?: Date, endTime?: Date) {
    if (!teamId.length) return [];
    let query = this.db
      .selectFrom("score_history")
      .select(["team_id", "score", "updated_at"])
      .where("team_id", "in", teamId)
      .orderBy("team_id", "asc")
      .orderBy("updated_at", "asc");
    if (startTime) {
      query = query.where("updated_at", ">=", startTime);
    }
    if (endTime) {
      query = query.where("updated_at", "<=", endTime);
    }
    return query.execute();
  }
}
