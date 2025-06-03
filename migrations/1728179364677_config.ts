import { sql, type Kysely } from "kysely";

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function up(db: Kysely<any>): Promise<void> {
  const schema = db.schema;

  await sql`CREATE EXTENSION IF NOT EXISTS unaccent`.execute(db);
  await sql`CREATE OR REPLACE FUNCTION immutable_unaccent(text) RETURNS text
AS $$
  SELECT public.unaccent('public.unaccent', $1);
$$ LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT`.execute(db);

  await schema
    .createTable("config")
    .addColumn("namespace", "varchar", (col) => col.primaryKey())
    .addColumn("value", "jsonb", (col) => col.notNull().defaultTo("{}"))
    .addColumn("version", "integer", (col) => col.notNull().defaultTo(1))
    .addColumn("created_at", "timestamptz", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addColumn("updated_at", "timestamptz", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .execute();

  await schema
    .createTable("audit_log")
    .addColumn("actor", "varchar(64)", (col) => col.notNull())
    .addColumn("operation", "varchar(64)", (col) => col.notNull())
    .addColumn("entities", sql`text[]`, (col) => col.notNull())
    .addColumn("data", "text")
    .addColumn("created_at", "timestamptz", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .execute();
  await schema
    .createIndex("audit_log_idx_created_at_actor")
    .on("audit_log")
    .expression(sql`created_at DESC, actor`)
    .execute();
  await schema
    .createIndex("audit_log_idx_created_at_operation")
    .on("audit_log")
    .expression(sql`created_at DESC, operation`)
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  const schema = db.schema;

  await schema.dropTable("audit_log").execute();
  await schema.dropTable("config").execute();
  await sql`DROP FUNCTION immutable_unaccent`.execute(db);
  await sql`DROP EXTENSION unaccent`.execute(db);
}
