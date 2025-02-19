import type { DB } from "@noctf/schema";
import type { DBType } from "../clients/database.ts";
import type { AllNonNullable } from "../types/primitives.ts";

export type DBSolve = AllNonNullable<DB["solve"]> & { created_at: Date };
export class SolveDAO {
  constructor(private readonly db: DBType) {}

  async getSolvesForChallenge(
    challenge_id: number,
    division_id?: number,
  ): Promise<DBSolve[]> {
    let query = this.getBaseSolveQuery().where(
      "solve.challenge_id",
      "=",
      challenge_id,
    );
    if (division_id) {
      query = query
        .innerJoin("division", "division.id", "division_id")
        .where("division_id", "=", division_id);
    }
    return (await query.execute()) as unknown as DBSolve[];
  }

  async getAllSolves(division_id?: number): Promise<DBSolve[]> {
    let query = this.getBaseSolveQuery();
    if (division_id) {
      query = query
        .innerJoin("division", "division.id", "division_id")
        .where("division_id", "=", division_id);
    }
    return (await query.execute()) as unknown as DBSolve[];
  }

  private getBaseSolveQuery() {
    return this.db
      .selectFrom("solve")
      .select([
        "solve.id as id",
        "solve.team_id as team_id",
        "solve.challenge_id as challenge_id",
        "solve.team_flags as team_flags",
        "solve.hidden as hidden",
        "solve.created_at as created_at",
      ])
      .orderBy("solve.created_at asc");
  }

  async getSolveCountForChallenge(challenge_id: number) {
    return (
      await this.db
        .selectFrom("solve")
        .select([(x) => x.fn.countAll().as("count")])
        .where("challenge_id", "=", challenge_id)
        .where("hidden", "=", false)
        .where((x) => x.not(x("team_flags", "&&", ["hidden"])))
        .executeTakeFirstOrThrow()
    ).count;
  }
}
