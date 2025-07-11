import { sql, type Kysely } from "kysely";
import {
  CreateTableWithDefaultTimestamps,
  CreateTriggerUpdatedAt,
} from "./util";

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function up(db: Kysely<any>): Promise<void> {
  const schema = db.schema;

  await CreateTableWithDefaultTimestamps(schema, "challenge")
    .addColumn("id", "integer", (col) =>
      col.primaryKey().generatedByDefaultAsIdentity(),
    )
    .addColumn("slug", "varchar(64)", (col) => col.notNull().unique())
    .addColumn("title", "varchar(128)", (col) => col.notNull())
    .addColumn("description", "text", (col) => col.notNull())
    .addColumn("private_metadata", "jsonb", (col) => col.notNull())
    .addColumn("tags", "jsonb", (col) => col.notNull().defaultTo("{}"))
    .addColumn("hidden", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("version", "integer", (col) => col.notNull().defaultTo(1))
    .addColumn("visible_at", "timestamptz")
    .execute();
  await CreateTriggerUpdatedAt("challenge").execute(db);

  await schema
    .createIndex("challenge_idx_tags")
    .on("challenge")
    .using("gin")
    .column("tags")
    .execute();

  await schema
    .createIndex("challenge_idx_hidden_visible_at")
    .on("challenge")
    .columns(["hidden", "visible_at"])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  const schema = db.schema;

  await schema.dropTable("challenge").execute();
}
