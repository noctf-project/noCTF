import { PolicyDocument } from "@noctf/api/datatypes";
import { DBType } from "../clients/database.ts";

export class PolicyDAO {
  constructor(private readonly db: DBType) {}

  async listPolicies(
    params: { is_enabled?: boolean } = {},
  ): Promise<PolicyDocument[]> {
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
        "is_enabled",
      ])
      .orderBy("id");
    if (typeof params.is_enabled === "boolean") {
      query = query.where("is_enabled", "=", params.is_enabled);
    }
    return await query.execute();
  }
}
