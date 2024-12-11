import { sql, type Kysely } from 'kysely'

/** Divisions are custom scoreboards */
/* eslint-disable @typescript-eslint/no-explicit-any */
export async function up(db: Kysely<any>): Promise<void> {
  const schema = db.schema.withSchema("core");

  await schema.createTable("division")
    .addColumn("id", "integer", (col) =>
      col.primaryKey().generatedByDefaultAsIdentity(),
    )
    .addColumn("name", "varchar", (col) => col.notNull())
    .addColumn("slug", "varchar(64)", (col) => col.notNull().unique())
    .addColumn("description", "text", (col) => col.notNull())
    .addColumn("flags", sql`varchar[]`, (col) => col.notNull().defaultTo("{}"))
    .execute();
  
  await schema.createTable("team_division")
    .addColumn("team_id", "integer", (col) =>
      col.notNull().references("core.team.id").onDelete("cascade"),
    )
    .addColumn("division_id", "integer", (col) =>
      col.notNull().references("core.division.id").onDelete("cascade"),
    )
    .addColumn("created_at", "timestamp", (col) =>
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
