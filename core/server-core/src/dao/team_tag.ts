import { TeamTag } from "@noctf/api/datatypes";
import { DBType } from "../clients/database.ts";
import { ConflictError } from "../errors.ts";
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
      .select(["id", "name", "is_joinable", "created_at"])
      .execute();
  }

  async create(v: { name: string; is_joinable: boolean }) {
    const i = {
      name: v.name,
      is_joinable: v.is_joinable,
    };
    try {
      const result = await this.db
        .insertInto("team_tag")
        .values(i)
        .returning("id")
        .executeTakeFirstOrThrow();
      return {
        ...i,
        id: result.id,
      };
    } catch (e) {
      const pgerror = TryPGConstraintError(e, CREATE_ERROR_CONFIG);
      if (pgerror) throw pgerror;
      throw e;
    }
  }
}
