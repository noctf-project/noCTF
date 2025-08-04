import { TeamTag } from "@noctf/api/datatypes";
import { DBType } from "../clients/database.ts";
import { ConflictError, NotFoundError } from "../errors.ts";
import {
  PostgresErrorCode,
  PostgresErrorConfig,
  TryPGConstraintError,
} from "../util/pgerror.ts";

const CREATE_ERROR_CONFIG: PostgresErrorConfig = {
  [PostgresErrorCode.Duplicate]: {
    challenge_slug_key: () => new ConflictError("The tag already exists"),
  },
};

export class TeamTagDAO {
  constructor(private readonly db: DBType) {}

  async list(): Promise<TeamTag[]> {
    return this.db
      .selectFrom("team_tag")
      .select(["id", "name", "description", "is_joinable", "created_at"])
      .execute();
  }

  async create(
    v: Pick<TeamTag, "name" | "description" | "is_joinable">,
  ): Promise<TeamTag> {
    const i = {
      name: v.name,
      description: v.description,
      is_joinable: v.is_joinable,
    };
    try {
      const result = await this.db
        .insertInto("team_tag")
        .values(i)
        .returning(["id", "created_at"])
        .executeTakeFirstOrThrow();
      return {
        ...i,
        created_at: result.created_at,
        id: result.id,
      };
    } catch (e) {
      const pgerror = TryPGConstraintError(e, CREATE_ERROR_CONFIG);
      if (pgerror) throw pgerror;
      throw e;
    }
  }

  async delete(id: number) {
    const rows = await this.db
      .deleteFrom("team_tag")
      .where("id", "=", id)
      .executeTakeFirst();
    if (!rows.numDeletedRows) {
      throw new NotFoundError("Could not find tag");
    }
  }

  async update(
    id: number,
    v: Pick<TeamTag, "name" | "description" | "is_joinable">,
  ) {
    const { numUpdatedRows } = await this.db
      .updateTable("team_tag")
      .set({
        name: v.name,
        description: v.description,
        is_joinable: v.is_joinable,
      })
      .where("id", "=", id)
      .executeTakeFirst();
    if (!numUpdatedRows) {
      throw new NotFoundError("Could not find tag");
    }
  }

  async assign(team_id: number, tag_ids: number[]) {
    if (!tag_ids.length) return;
    await this.db
      .insertInto("team_tag_member")
      .values(
        tag_ids.map((tag_id) => ({
          team_id,
          tag_id,
        })),
      )
      .onConflict((b) => b.doNothing())
      .executeTakeFirst();
  }

  async unassignAll(team_id: number) {
    await this.db
      .deleteFrom("team_tag_member")
      .where("team_id", "=", team_id)
      .execute();
  }
}
