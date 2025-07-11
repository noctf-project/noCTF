import { PolicyDocument } from "@noctf/api/datatypes";
import { DBType } from "../clients/database.ts";
import { Insertable, Updateable } from "kysely";
import { DB } from "@noctf/schema";
import { FilterUndefined } from "../util/filter.ts";
import { ConflictError, NotFoundError } from "../errors.ts";
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

export class PolicyDAO {
  constructor(private readonly db: DBType) {}

  async list(params: { is_enabled?: boolean } = {}): Promise<PolicyDocument[]> {
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
        "version"
      ])
      .orderBy("id");
    if (typeof params.is_enabled === "boolean") {
      query = query.where("is_enabled", "=", params.is_enabled);
    }
    return await query.execute();
  }

  async update(
    id: number,
    {
      name,
      description,
      permissions,
      public: _public,
      match_roles,
      omit_roles,
      is_enabled,
      version
    }: Updateable<DB["policy"]>,
  ) {
    let query = this.db
      .updateTable("policy")
      .set(
        (eb) => FilterUndefined({
          name,
          description,
          permissions,
          public: _public,
          match_roles,
          omit_roles,
          is_enabled,
          version: eb("version", "+", 1)
        }),
      )
      .where("id", "=", id)
      .returning(["version"]);
    if (version || version === 0) {
      query = query.where("version", "=", version);
    }
    const result = await query.executeTakeFirst();
    if (!result.numUpdatedRows) {
      throw new NotFoundError("Policy not found");
    }
    return { version: version + 1 };
  }

  async create({
    name,
    description,
    permissions,
    public: _public,
    match_roles,
    omit_roles,
    is_enabled,
  }: Insertable<DB["policy"]>): Promise<PolicyDocument> {
    const v = {
      name,
      description: description || "",
      permissions: permissions || [],
      public: !!_public,
      match_roles: match_roles || [],
      omit_roles: omit_roles || [],
      is_enabled: !!is_enabled,
    };
    try {
      const { id, version } = await this.db
        .insertInto("policy")
        .values(v)
        .returning(["id", "version"])
        .executeTakeFirstOrThrow();

      return {
        ...v,
        id,
        version,
      };
    } catch (e) {
      const pgerror = TryPGConstraintError(e, CREATE_ERROR_CONFIG);
      if (pgerror) throw pgerror;
      throw e;
    }
  }

  async delete(id: number, version?: number) {
    const query = this.db
      .deleteFrom("policy")
      .where("id", "=", id);
    
      .executeTakeFirstOrThrow();
    if (!result.numDeletedRows) {
      throw new NotFoundError("Policy not found");
    }
  }
}
