import type { Insertable, Updateable } from "kysely";
import pg from "pg";
import type { DB } from "@noctf/schema";
import { ConflictError, NotFoundError } from "../errors.ts";
import type { DBType } from "../clients/database.ts";
import type { User } from "@noctf/api/datatypes";

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
      .select(["id", "name", "bio", "roles", "created_at"])
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
      .executeTakeFirst();
  }

  async create({
    name,
    bio,
    roles,
  }: Pick<Insertable<DB["user"]>, "name" | "bio" | "roles">) {
    try {
      const { id } = await this.db
        .insertInto("user")
        .values({
          name,
          bio,
          roles,
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
    {
      name,
      bio,
      roles,
    }: Pick<Updateable<DB["user"]>, "name" | "bio" | "roles">,
  ) {
    const { numUpdatedRows } = await this.db
      .updateTable("user")
      .set({
        name,
        bio,
        roles,
      })
      .where("id", "=", id)
      .executeTakeFirst();
    if (!numUpdatedRows) {
      throw new NotFoundError("User not found");
    }
  }
}
