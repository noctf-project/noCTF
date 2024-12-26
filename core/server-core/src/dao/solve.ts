import { DBType } from "../clients/database.ts";

export class SolveDAO {
  async getSolvesForChallenge(db: DBType, challenge_id: number) {
    return await db
      .selectFrom("core.solve")
      .select(["id", "team_id", "challenge_id", "team_flags", "hidden"])
      .where("challenge_id", "=", challenge_id)
      .execute();
  }
}
