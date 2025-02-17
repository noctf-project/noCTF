import { DBType } from "../clients/database.ts";

export class DivisionDAO {
  async listDivisions(db: DBType) {
    return db
      .selectFrom("division")
      .select(["id", "name", "slug", "description", "created_at"])
      .execute();
  }
}
