import { DBType } from "../clients/database.ts";

export class DivisionDAO {
  async getAllTeamSolveBases(db: DBType) {
    return db
      .selectFrom("team_division")
      .innerJoin("division", "division.id", "team_division.division_id")
      .distinct()
      .select([
        "team_division.team_id as team_id",
        "division.solve_base_id as solve_base_id",
      ])
      .execute();
  }
}
