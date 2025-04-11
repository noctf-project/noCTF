import { Division } from "@noctf/api/datatypes";
import { DBType } from "../clients/database.ts";
import { NotFoundError } from "../errors.ts";

export class DivisionDAO {
  constructor(private readonly db: DBType) {}

  async list(params?: {
    is_visible?: boolean;
    visible_ids?: number[];
  }): Promise<Division[]> {
    let query = this.listQuery();
    if (params?.is_visible) {
      if (params?.visible_ids && params?.visible_ids.length) {
        query = query.where((eb) =>
          eb.or([
            eb("is_visible", "=", true),
            eb("id", "in", params.visible_ids || []),
          ]),
        );
      } else {
        query = query.where("is_visible", "=", true);
      }
    }
    return query.execute();
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
