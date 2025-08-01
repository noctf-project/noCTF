import { sql, type Kysely } from "kysely";
import {
  CreateTableWithDefaultTimestamps,
  CreateTriggerUpdatedAt,
} from "./util";

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function up(db: Kysely<any>): Promise<void> {
  const schema = db.schema;
  await CreateTableWithDefaultTimestamps(schema, "team_tag")
    .addColumn("id", "integer", (col) =>
      col.primaryKey().generatedByDefaultAsIdentity(),
    )
    .addColumn("name", "varchar(64)", (col) => col.notNull().unique())
    .addColumn("description", "text", (col) => col.notNull().defaultTo(""))
    .addColumn("is_joinable", "boolean", (col) =>
      col.notNull().defaultTo(false),
    )
    .execute();

  await CreateTriggerUpdatedAt("team_tag").execute(db);

  await CreateTableWithDefaultTimestamps(schema, "team_tag_member", [
    "created_at",
  ])
    .addColumn("tag_id", "integer", (e) =>
      e.notNull().references("team_tag.id").onDelete("cascade"),
    )
    .addColumn("team_id", "integer", (e) =>
      e.notNull().references("team.id").onDelete("cascade"),
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
