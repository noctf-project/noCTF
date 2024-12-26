import { DBType } from "../clients/database.ts";

export class SolveDAO {
  async getSolvesForChallenge(db: DBType, challenge_id: number) {
    return await db
      .selectFrom("core.solve")
      .select([
        "id",
        "team_id",
        "challenge_id",
        "team_flags",
        "hidden",
        "created_at",
      ])
      .where("challenge_id", "=", challenge_id)
      .orderBy("created_at asc")
      .execute();
  }

  async getSolveCountForChallenge(db: DBType, challenge_id: number) {
    return (
      await db
        .selectFrom("core.solve")
        .select([(x) => x.fn.countAll().as("count")])
        .where("challenge_id", "=", challenge_id)
        .where("hidden", "=", false)
        .where((x) => x.not(x("team_flags", "&&", ["hidden"])))
        .executeTakeFirst()
    ).count;
  }
}
