import { type Insertable, type Updateable } from "kysely";
import pg from "pg";
import type { DB } from "@noctf/schema";
import { ConflictError, NotFoundError } from "../errors.ts";
import type { DBType } from "../clients/database.ts";
import { FilterUndefined } from "../util/filter.ts";
import type { UserSummary, User } from "@noctf/api/datatypes";
import { NormalizeName } from "../util/string.ts";
import { SplitYesNoQuery } from "./util.ts";

export class UserDAO {
  constructor(private readonly db: DBType) {}

  async getIdForName(name: string) {
    const result = await this.db
      .selectFrom("user")
      .select(["id"])
      .where("name", "=", name)
      .executeTakeFirst();
    return result?.id;
  }

  async get(id: number): Promise<User | undefined> {
    return await this.db
      .selectFrom("user")
      .select(["id", "name", "country", "bio", "roles", "flags", "created_at"])
      .where("id", "=", id)
      .executeTakeFirst();
  }

  async getNameAndProviderId(
    id: number,
    provider: string,
  ): Promise<{ name: string; provider_id: string } | undefined> {
    return await this.db
      .selectFrom("user as u")
      .innerJoin("user_identity as ui", "ui.user_id", "u.id")
      .select(["u.name as name", "ui.provider_id as provider_id"])
      .where("u.id", "=", id)
      .where("ui.provider", "=", provider)
      .executeTakeFirst();
  }

  async getFlagsAndRoles(
    id: number,
  ): Promise<
    { roles: string[]; flags: string[]; team_id: number | null } | undefined
  > {
    const result = await this.db
      .selectFrom("user")
      .leftJoin("team_member as tm", "user.id", "tm.user_id")
      .select(["roles", "flags", "tm.team_id as team_id"])
      .where("id", "=", id)
      .executeTakeFirst();
    return result;
  }

  async listSummary(
    params?: Parameters<UserDAO["listQuery"]>[0],
    limit?: Parameters<UserDAO["listQuery"]>[1],
  ): Promise<UserSummary[]> {
    const query = this.listQuery(params, limit)
      .leftJoin("team_member as tm", "user.id", "tm.user_id")
      .select([
        "user.id",
        "user.name",
        "user.country",
        "user.bio",
        "user.created_at",
        "user.flags",
        "user.roles",
        "tm.team_id as team_id",
      ])
      .orderBy("id");

    return query.execute();
  }

  async getCount(
    params?: Parameters<UserDAO["listQuery"]>[0],
  ): Promise<number> {
    return (
      await this.listQuery(params)
        .select(this.db.fn.countAll().as("count"))
        .executeTakeFirstOrThrow()
    ).count as number;
  }

  async create({
    name,
    country,
    bio,
    roles,
    flags,
  }: Pick<
    Insertable<DB["user"]>,
    "name" | "country" | "bio" | "roles" | "flags"
  >) {
    try {
      const { id } = await this.db
        .insertInto("user")
        .values({
          name,
          country,
          bio,
          roles,
          flags,
        })
        .returning("id")
        .executeTakeFirstOrThrow();
      return id;
    } catch (e) {
      if (e instanceof pg.DatabaseError && e.constraint) {
        throw new ConflictError("A user already exists with this name");
      }
      throw e;
    }
  }

  async update(
    id: number,
    v: Pick<
      Updateable<DB["user"]>,
      "name" | "country" | "bio" | "flags" | "roles"
    >,
  ) {
    const { numUpdatedRows } = await this.db
      .updateTable("user")
      .set(FilterUndefined(v))
      .where("id", "=", id)
      .executeTakeFirst();
    if (!numUpdatedRows) {
      throw new NotFoundError("User not found");
    }
  }

  private listQuery(
    params?: {
      flags?: string[];
      roles?: string[];
      ids?: number[];
      name?: string;
      created_at?: [Date | null, Date | null];
    },
    limit?: { limit?: number; offset?: number },
  ) {
    let query = this.db.selectFrom("user");
    if (params?.created_at) {
      if (params.created_at[0])
        query = query.where("created_at", ">=", params.created_at[0]);
      if (params.created_at[1])
        query = query.where("created_at", "<=", params.created_at[1]);
    }
    if (params?.flags) {
      query = SplitYesNoQuery(query, "flags", params.flags);
    }
    if (params?.roles) {
      query = SplitYesNoQuery(query, "roles", params.roles);
    }
    if (params?.name) {
      const normalized = NormalizeName(params.name).replace(/[_%]/g, "\\$&");
      query = query.where("name_normalized", "ilike", `%${normalized}%`);
    }
    if (params?.ids && params?.ids.length) {
      query = query.where("id", "in", params.ids);
    }

    if (limit?.limit) {
      query = query.limit(limit.limit);
    }
    if (limit?.offset) {
      query = query.offset(limit.offset);
    }
    return query;
  }

  async delete(id: number) {
    const { numDeletedRows } = await this.db
      .deleteFrom("user")
      .where("id", "=", id)
      .executeTakeFirst();
    if (!numDeletedRows) {
      throw new NotFoundError("User not found");
    }
  }
}
