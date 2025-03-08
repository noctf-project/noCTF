import { ScoreboardEntry } from "@noctf/api/datatypes";
import { DBType } from "../clients/database.ts";

export class ScoreHistoryDAO {
  constructor(private readonly db: DBType) {}

  async add(entries: ScoreboardEntry[]) {
    if (!entries.length) return;
    await this.db
      .insertInto("score_history")
      .values(entries)
      .onConflict((o) =>
        o.columns(["team_id", "timestamp"]).doUpdateSet({
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

  async getByTeam(teamId: number, startTime?: Date, endTime?: Date) {
    let query = this.db
      .selectFrom("score_history")
      .select(["team_id", "score", "timestamp"])
      .where("team_id", "=", teamId)
      .orderBy("timestamp", "asc");
    if (startTime) {
      query = query.where("timestamp", ">=", startTime);
    }
    if (endTime) {
      query = query.where("timestamp", "<=", endTime);
    }
    return query.execute();
  }
}
