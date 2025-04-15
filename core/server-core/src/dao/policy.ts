import { DBType } from "../clients/database.ts";

export class PolicyDAO {
  constructor(private readonly db: DBType) {}

  async listPolicies(params: { enabled?: boolean } = {}) {
    let query = this.db
      .selectFrom("policy")
      .select([
        "id",
        "name",
        "description",
        "permissions",
        "public",
        "match_roles",
        "omit_roles",
        "enabled",
      ])
      .orderBy("id");
    if (typeof params.enabled === "boolean") {
      query = query.where("enabled", "=", params.enabled);
    }
    return await query.execute();
  }
}
