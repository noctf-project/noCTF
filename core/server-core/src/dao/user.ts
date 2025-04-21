import { sql, type Insertable, type Updateable } from "kysely";
import pg from "pg";
import type { DB } from "@noctf/schema";
import { ConflictError, NotFoundError } from "../errors.ts";
import type { DBType } from "../clients/database.ts";
import { FilterUndefined } from "../util/filter.ts";
import type { UserSummary, User } from "@noctf/api/datatypes";
import { partition } from "../util/object.ts";

export class UserDAO {
  constructor(private readonly db: DBType) {}

  async checkNameExists(name: string) {
    const result = await this.db
      .selectFrom("user")
      .select(this.db.fn.countAll().as("count"))
      .where("name", "=", name)
      .executeTakeFirstOrThrow();
    const count = result.count as unknown as string | number;
    return count != 0 && count != "0";
  }

  async get(id: number): Promise<User | undefined> {
    return await this.db
      .selectFrom("user")
      .select(["id", "name", "bio", "roles", "flags", "created_at"])
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
  ): Promise<{ roles: string[]; flags: string[] } | undefined> {
    const result = await this.db
      .selectFrom("user")
      .select(["roles", "flags"])
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
    bio,
    roles,
    flags,
  }: Pick<Insertable<DB["user"]>, "name" | "bio" | "roles" | "flags">) {
    try {
      const { id } = await this.db
        .insertInto("user")
        .values({
          name,
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
    v: Pick<Updateable<DB["user"]>, "name" | "bio" | "flags" | "roles">,
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
      ids?: number[];
      name_prefix?: string;
    },
    limit?: { limit?: number; offset?: number },
  ) {
    let query = this.db.selectFrom("user");
    if (params?.flags) {
      const [no, yes] = partition(params.flags, (f) => f.startsWith("!"));

      if (yes.length) {
        query = query.where("flags", "&&", sql.val(yes));
      }
      if (no.length) {
        query = query.where((eb) =>
          eb.not(eb("flags", "&&", eb.val(no.map((f) => f.substring(1))))),
        );
      }
    }
    if (params?.name_prefix) {
      query = query.where("name", "^@", params.name_prefix.toLowerCase());
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
}
