import { Division } from "@noctf/api/datatypes";
import { DBType } from "../clients/database.ts";

export class DivisionDAO {
  constructor(private readonly db: DBType) {}

  async list(): Promise<Division[]> {
    return this.listQuery().execute();
  }

  async get(id: number): Promise<Division> {
    return this.listQuery().where("id", "=", id).executeTakeFirstOrThrow();
  }

  private listQuery() {
    return this.db
      .selectFrom("division")
      .select([
        "id",
        "name",
        "slug",
        "description",
        "created_at",
        "password",
        "is_visible",
        "is_joinable",
      ]);
  }
}
