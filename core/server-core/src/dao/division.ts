import { DBType } from "../clients/database.ts";

export class DivisionDAO {
  constructor(private readonly db: DBType) {}
  async listDivisions() {
    return this.db
      .selectFrom("division")
      .select(["id", "name", "slug", "description", "created_at"])
      .execute();
  }
}
