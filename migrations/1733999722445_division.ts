import { sql, type Kysely } from "kysely";

/** Divisions are custom scoreboards */
/* eslint-disable @typescript-eslint/no-explicit-any */
export async function up(db: Kysely<any>): Promise<void> {
  const schema = db.schema;
  await schema
    .createTable("solve_base")
    .addColumn("id", "integer", (col) =>
      col.primaryKey().generatedByDefaultAsIdentity(),
    )
    .addColumn("name", "varchar", (col) => col.notNull())
    .addColumn("slug", "varchar(64)", (col) => col.notNull().unique())
    .addColumn("description", "text", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .execute();

  await schema
    .createTable("division")
    .addColumn("id", "integer", (col) =>
      col.primaryKey().generatedByDefaultAsIdentity(),
    )
    .addColumn("name", "varchar", (col) => col.notNull())
    .addColumn("slug", "varchar(64)", (col) => col.notNull().unique())
    .addColumn("description", "text", (col) => col.notNull())
    .addColumn("solve_base_id", "integer", (col) =>
      col.notNull().references("solve_base.id"),
    )
    .addColumn("visible", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("joinable", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("created_at", "timestamptz", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .execute();

  const solve_base = await db
    .insertInto("solve_base")
    .values({
      name: "Default",
      slug: "default",
      description: "Default Solve Base",
    })
    .returning("id")
    .executeTakeFirst();

  await db
    .insertInto("division")
    .values({
      name: "Global",
      slug: "global",
      description: "Global",
      visible: true,
      solve_base_id: solve_base?.id,
    })
    .execute();

  await schema
    .createTable("team_division")
    .addColumn("team_id", "integer", (col) =>
      col.notNull().references("team.id").onDelete("cascade"),
    )
    .addColumn("division_id", "integer", (col) =>
      col.notNull().references("division.id").onDelete("cascade"),
    )
    .addColumn("created_at", "timestamptz", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addPrimaryKeyConstraint("team_division_pkey", ["team_id", "division_id"])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  const schema = db.schema;

  await schema.dropTable("team_division").execute();
  await schema.dropTable("division").execute();
  await schema.dropTable("solve_base").execute();
}
