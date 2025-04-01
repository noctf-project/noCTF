import { DB } from "@noctf/schema";
import { AllNonNullable } from "../types/primitives.ts";
import { DBType } from "../clients/database.ts";

export type DBAward = AllNonNullable<DB["award"]> & { created_at: Date };

export class AwardDAO {
  constructor(private readonly db: DBType) {}

  async getAwardsForTeam(team_id: number): Promise<DBAward[]> {
    let query = this.getBaseQuery().where("team_id", "=", team_id);
    return (await query.execute()) as unknown as DBAward[];
  }

  async getAllAwards(
    division_id?: number,
    params?: {
      sort?: "asc" | "desc";
      limit?: number;
      offset?: number;
    },
  ): Promise<DBAward[]> {
    let query = this.getBaseQuery();
    if (division_id) {
      query = query
        .innerJoin("team", "team.id", "award.team_id")
        .where("team.division_id", "=", division_id);
    }
    if (params?.limit) {
      query = query.limit(params.limit);
    }
    if (params?.offset) {
      query = query.offset(params.offset);
    }
    return (await query.execute()) as unknown as DBAward[];
  }

  private getBaseQuery() {
    return this.db
      .selectFrom("award")
      .select([
        "award.id as id",
        "award.team_id as team_id",
        "award.value as value",
        "award.title as title",
        "award.created_at as created_at",
      ]);
  }
}
