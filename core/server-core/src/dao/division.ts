import { Division } from "@noctf/api/datatypes";
import { DBType } from "../clients/database.ts";
import { ConflictError, NotFoundError } from "../errors.ts";
import { FilterUndefined } from "../util/filter.ts";
import { Insertable, Updateable } from "kysely";
import { DB } from "@noctf/schema";
import {
  PostgresErrorCode,
  PostgresErrorConfig,
  TryPGConstraintError,
} from "../util/pgerror.ts";

const CREATE_ERROR_CONFIG: PostgresErrorConfig = {
  [PostgresErrorCode.Duplicate]: {
    default: (e) =>
      new ConflictError("A duplicate entry was detected", { cause: e }),
  },
};

export class DivisionDAO {
  constructor(private readonly db: DBType) {}

  async list(): Promise<Division[]> {
    return this.listQuery().execute();
  }

  async get(id: number): Promise<Division | undefined> {
    return this.listQuery().where("id", "=", id).executeTakeFirst();
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

  async create({
    name,
    is_joinable,
    is_visible,
    slug,
    password,
    description,
  }: Insertable<DB["division"]>): Promise<Division> {
    try {
      const result = await this.db
        .insertInto("division")
        .values({
          name,
          is_joinable,
          is_visible,
          slug,
          password,
          description,
        })
        .returning(["id", "created_at", "is_joinable", "is_visible"])
        .executeTakeFirstOrThrow();

      return {
        ...result,
        name,
        password,
        slug,
        description,
      };
    } catch (e) {
      const pgerror = TryPGConstraintError(e, CREATE_ERROR_CONFIG);
      if (pgerror) throw pgerror;
      throw e;
    }
  }

  async update(
    id: number,
    v: Pick<
      Updateable<DB["division"]>,
      | "name"
      | "is_visible"
      | "is_joinable"
      | "slug"
      | "password"
      | "description"
    >,
  ) {
    const { numUpdatedRows } = await this.db
      .updateTable("division")
      .set(
        FilterUndefined({
          name: v.name,
          is_joinable: v.is_joinable,
          is_visible: v.is_visible,
          slug: v.slug,
          password: v.password,
          description: v.description,
        }),
      )
      .where("id", "=", id)
      .executeTakeFirst();
    if (!numUpdatedRows) {
      throw new NotFoundError("Could not find division");
    }
  }

  async delete(id: number) {
    const rows = await this.db
      .deleteFrom("division")
      .where("id", "=", id)
      .executeTakeFirst();
    if (!rows.numDeletedRows) {
      throw new NotFoundError("Could not find division");
    }
  }
}
