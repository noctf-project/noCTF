import type { DB } from "@noctf/schema";
import type { DBType } from "../clients/database.ts";
import type { AllNonNullable } from "../types/primitives.ts";

type DBSolve = AllNonNullable<DB["solve"]> & { created_at: Date };
export class SolveDAO {
  async getSolvesForChallenge(
    db: DBType,
    challenge_id: number,
  ): Promise<DBSolve[]> {
    return (await db
      .selectFrom("solve")
      .select([
        "id",
        "team_id",
        "challenge_id",
        "team_flags",
        "hidden",
        "created_at",
      ])
      .orderBy("created_at asc")
      .where("challenge_id", "=", challenge_id)
      .execute()) as unknown as DBSolve[];
  }

  async getSolveCountForChallenge(db: DBType, challenge_id: number) {
    return (
      await db
        .selectFrom("solve")
        .select([(x) => x.fn.countAll().as("count")])
        .where("challenge_id", "=", challenge_id)
        .where("hidden", "=", false)
        .where((x) => x.not(x("team_flags", "&&", ["hidden"])))
        .executeTakeFirstOrThrow()
    ).count;
  }
}
