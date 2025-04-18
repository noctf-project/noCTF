import { sql } from "kysely";
import { DBType } from "../clients/database.ts";

export class ScoreHistoryDAO {
  constructor(private readonly db: DBType) {}

  async add(entries: { team_id: number; score: number }[]) {
    if (!entries.length) return;
    await this.db
      .insertInto("score_history")
      .values(
        entries.map(({ team_id, score }) => ({
          team_id,
          updated_at: sql`CURRENT_TIMESTAMP`,
          score,
        })),
      )
      .onConflict((o) =>
        o.columns(["team_id", "updated_at"]).doUpdateSet({
          score: (eb) => eb.ref("excluded.score"),
        }),
      )
      .execute();
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
