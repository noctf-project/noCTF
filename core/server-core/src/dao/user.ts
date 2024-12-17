import { Insertable, Kysely, Updateable } from "kysely";
import pg from "pg";
import { DB } from "@noctf/schema";
import { ConflictError, NotFoundError } from "../errors.ts";

export class UserDAO {
  async checkNameExists(db: Kysely<DB>, name: string) {
    const result = await db
      .selectFrom("core.user")
      .select(db.fn.countAll().as("count"))
      .where("name", "=", name)
      .executeTakeFirst();
    const count = result.count as unknown as string | number;
    return count != 0 && count != "0";
  }

  async insert(
    db: Kysely<DB>,
    {
      name,
      bio,
      roles,
    }: Pick<Insertable<DB["core.user"]>, "name" | "bio" | "roles">,
  ) {
    console.log(roles);
    try {
      const { id } = await db
        .insertInto("core.user")
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
    }
  }

  async update(
    db: Kysely<DB>,
    id: number,
    {
      name,
      bio,
      roles,
    }: Pick<Updateable<DB["core.user"]>, "name" | "bio" | "roles">,
  ) {
    const { numUpdatedRows } = await db
      .updateTable("core.user")
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
