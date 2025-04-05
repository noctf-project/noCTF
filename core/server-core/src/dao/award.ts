import { DB } from "@noctf/schema";
import { AllNonNullable } from "../types/primitives.ts";
import { DBType } from "../clients/database.ts";
import { Award } from "@noctf/api/datatypes";

export class AwardDAO {
  constructor(private readonly db: DBType) {}

  async getTeamAwards(
    team_id: number,
    params?: {
      end_time?: Date;
    },
  ): Promise<Award[]> {
    let query = this.getBaseQuery().where("team_id", "=", team_id);
    if (params?.end_time) {
      query = query.where("award.created_at", "<=", params.end_time);
    }
    return (await query.execute()) as unknown as Award[];
  }

  async getAllAwards(
    division_id?: number,
    params?: {
      sort?: "asc" | "desc";
      limit?: number;
      offset?: number;
    },
  ): Promise<Award[]> {
    let query = this.getBaseQuery();
    if (division_id) {
      query = query.where("team.division_id", "=", division_id);
    }
    if (params?.limit) {
      query = query.limit(params.limit);
    }
    if (params?.offset) {
      query = query.offset(params.offset);
    }
    return await query.execute();
  }

  private getBaseQuery() {
    return this.db
      .selectFrom("award")
      .innerJoin("team", "team.id", "award.team_id")
      .select([
        "award.id as id",
        "award.team_id as team_id",
        "award.value as value",
        "award.title as title",
        "award.created_at as created_at",
      ]);
  }
}
