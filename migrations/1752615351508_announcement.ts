import { sql, type Kysely } from "kysely";
import {
  CreateTableWithDefaultTimestamps,
  CreateTriggerUpdatedAt,
} from "./util";

export async function up(db: Kysely<any>): Promise<void> {
  const schema = db.schema;

  await CreateTableWithDefaultTimestamps(schema, "announcement")
    .addColumn("id", "integer", (col) =>
      col.primaryKey().generatedByDefaultAsIdentity(),
    )
    .addColumn("title", "varchar(128)", (col) => col.notNull())
    .addColumn("message", "text", (col) => col.notNull())
    .addColumn("created_by", "integer", (col) =>
      col.references("user.id").onDelete("set null"),
    )
    .addColumn("updated_by", "integer", (col) =>
      col.references("user.id").onDelete("set null"),
    )
    .addColumn("visible_to", sql`varchar[]`, (col) =>
      col.notNull().defaultTo("{}"),
    )
    .addColumn("delivery_channels", sql`varchar[]`, (col) =>
      col.notNull().defaultTo("{}"),
    )
    .execute();

  await CreateTriggerUpdatedAt("announcement").execute(db);
  await schema
    .createIndex("announcement_idx_updated_at_desc_visible_to")
    .on("announcement")
    .columns(["updated_at desc", "visible_to"])
    .execute();
  await schema
    .createIndex("announcement_idx_created_at_desc_visible_to")
    .on("announcement")
    .columns(["created_at desc", "visible_to"])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  const schema = db.schema;

  await schema.dropTable("announcement").execute();
}
