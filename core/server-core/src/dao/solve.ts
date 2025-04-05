import type { DB } from "@noctf/schema";
import type { DBType } from "../clients/database.ts";
import type { AllNonNullable } from "../types/primitives.ts";

export type DBSolve = AllNonNullable<DB["solve"]> & { created_at: Date };
export class SolveDAO {
  constructor(private readonly db: DBType) {}

  async getAllSolves(
    division_id?: number,
    params?: {
      sort?: "asc" | "desc";
      limit?: number;
      offset?: number;
    },
  ): Promise<DBSolve[]> {
    let query = this.getBaseQuery().orderBy(
      "solve.created_at",
      params?.sort || "asc",
    );
    if (division_id) {
      query = query.where("division_id", "=", division_id);
    }
    if (params?.limit) {
      query = query.limit(params.limit);
    }
    if (params?.offset) {
      query = query.offset(params.offset);
    }
    return (await query.execute()) as unknown as DBSolve[];
  }

  async getTeamSolves(
    team_id: number,
    params?: {
      end_time?: Date;
      hidden?: boolean;
    },
  ): Promise<DBSolve[]> {
    let query = this.getBaseQuery().where("solve.team_id", "=", team_id);
    if (params?.end_time) {
      query = query.where("solve.created_at", "<=", params.end_time);
    }
    if (typeof params?.hidden === "boolean") {
      query = query.where("solve.hidden", "=", params.hidden);
    }
    return query.execute() as unknown as DBSolve[];
  }

  private getBaseQuery() {
    return this.db
      .selectFrom("solve")
      .select([
        "solve.id as id",
        "solve.team_id as team_id",
        "solve.challenge_id as challenge_id",
        "solve.hidden as hidden",
        "solve.created_at as created_at",
      ]);
  }
}
