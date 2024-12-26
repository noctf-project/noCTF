import { sql, type Kysely } from "kysely";

/** Divisions are custom scoreboards */
/* eslint-disable @typescript-eslint/no-explicit-any */
export async function up(db: Kysely<any>): Promise<void> {
  const schema = db.schema.withSchema("core");

  await schema
    .createTable("division")
    .addColumn("id", "integer", (col) =>
      col.primaryKey().generatedByDefaultAsIdentity(),
    )
    .addColumn("name", "varchar", (col) => col.notNull())
    .addColumn("slug", "varchar(64)", (col) => col.notNull().unique())
    .addColumn("description", "text", (col) => col.notNull())
    .addColumn("visible", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("joinable", "boolean", (col) => col.notNull().defaultTo(false))
    .execute();

  await schema
    .createTable("team_division")
    .addColumn("team_id", "integer", (col) =>
      col.notNull().references("core.team.id").onDelete("cascade"),
    )
    .addColumn("division_id", "integer", (col) =>
      col.notNull().references("core.division.id").onDelete("cascade"),
    )
    .addColumn("created_at", "timestamptz", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addPrimaryKeyConstraint("team_division_pkey", ["team_id", "division_id"])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  const schema = db.schema.withSchema("core");

  await schema.dropTable("team_division").execute();
  await schema.dropTable("division").execute();
}
