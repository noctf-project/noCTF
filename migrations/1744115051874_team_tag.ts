import { sql, type Kysely } from "kysely";

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function up(db: Kysely<any>): Promise<void> {
  const schema = db.schema;
  await schema
    .createTable("team_tag")
    .addColumn("id", "integer", (col) =>
      col.primaryKey().generatedByDefaultAsIdentity(),
    )
    .addColumn("name", "varchar(64)", (col) => col.notNull().unique())
    .addColumn("is_visible", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("is_joinable", "boolean", (col) =>
      col.notNull().defaultTo(false),
    )
    .addColumn("created_at", "timestamptz", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .execute();

  await db.schema
    .createTable("team_tag_member")
    .addColumn("tag_id", "integer", (e) =>
      e.notNull().references("team_tag.id").onDelete("cascade"),
    )
    .addColumn("team_id", "integer", (e) =>
      e.notNull().references("team.id").onDelete("cascade"),
    )
    .addColumn("created_at", "timestamptz", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addUniqueConstraint("team_tag_member_uidx_tag_id_team_id", [
      "tag_id",
      "team_id",
    ])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("team_tag_member").execute();
  await db.schema.dropTable("team_tag").execute();
}
