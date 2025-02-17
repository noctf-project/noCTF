import type { DB } from "@noctf/schema";
import type { DBType } from "../clients/database.ts";
import type { AllNonNullable } from "../types/primitives.ts";

export type DBSolve = AllNonNullable<DB["solve"]> & { created_at: Date };
export class SolveDAO {
  async getSolvesForChallenge(
    db: DBType,
    challenge_id: number,
    division_id?: number,
  ): Promise<DBSolve[]> {
    let query = this.getBaseSolveQuery(db).where(
      "solve.challenge_id",
      "=",
      challenge_id,
    );
    if (division_id) {
      query = query
        .innerJoin("team_division", "team_division.team_id", "solve.team_id")
        .innerJoin("division", "division.id", "team_division.division_id")
        .where("division.id", "=", division_id);
    }
    return (await query.execute()) as unknown as DBSolve[];
  }

  async getAllSolves(db: DBType, solve_base_id?: number): Promise<DBSolve[]> {
    let query = this.getBaseSolveQuery(db);
    if (solve_base_id) {
      query = query
        .innerJoin("team_division", "team_division.team_id", "solve.team_id")
        .innerJoin("division", "division.id", "team_division.division_id")
        .where("division.solve_base_id", "=", solve_base_id);
    }
    return (await query.execute()) as unknown as DBSolve[];
  }

  private getBaseSolveQuery(db: DBType) {
    return db
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
