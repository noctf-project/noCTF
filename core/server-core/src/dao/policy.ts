import { DBType } from "../clients/database.ts";

export class PolicyDAO {
  constructor(private readonly db: DBType) {}

  async listPolicies() {
    return await this.db
      .selectFrom("policy")
      .select([
        "id",
        "name",
        "description",
        "permissions",
        "public",
        "match_roles",
        "omit_roles",
      ])
      .orderBy("id")
      .execute();
  }
}
