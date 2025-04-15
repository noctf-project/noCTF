import { sql, type Kysely } from "kysely";

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function up(db: Kysely<any>): Promise<void> {
  const schema = db.schema;
  await schema
    .createTable("lock")
    .addColumn("key", "varchar", (col) => col.notNull().primaryKey())
    .addColumn("value", "varchar", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .execute();

  await schema
    .createTable("file")
    .addColumn("id", "integer", (col) =>
      col.primaryKey().generatedByDefaultAsIdentity(),
    )
    .addColumn("hash", "bytea", (col) => col.notNull())
    .addColumn("ref", "varchar", (col) => col.notNull())
    .addColumn("filename", "varchar(255)", (col) => col.notNull())
    .addColumn("provider", "varchar(64)", (col) => col.notNull())
    .addColumn("mime", "varchar(64)", (col) => col.notNull())
    .addColumn("size", "bigint", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .execute();

  await schema
    .createTable("session")
    .addColumn("id", "integer", (col) =>
      col.primaryKey().generatedByDefaultAsIdentity(),
    )
    .addColumn("hash", "bytea", (col) => col.notNull().unique())
    .addColumn("user_id", "integer", (col) =>
      col.notNull().references("user.id").onDelete("cascade"),
    )
    .addColumn("type", "varchar(32)", (col) => col.notNull())
    .addColumn("data", "jsonb", (col) => col.notNull().defaultTo("{}"))
    .addColumn("ip", "varchar(64)")
    .addColumn("client", "varchar(64)")
    .addColumn("created_at", "timestamptz", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addColumn("refreshed_at", "timestamptz", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addColumn("expires_at", "timestamptz", (col) => col.notNull())
    .execute();
  await schema
    .createIndex("session_idx_user_id_type")
    .on("session")
    .columns(["user_id", "type"])
    .execute();
  await schema
    .createIndex("session_idx_user_id_client")
    .on("session")
    .columns(["user_id", "client"])
    .execute();
  await schema
    .createIndex("session_idx_expires_at")
    .on("session")
    .expression(sql`expires_at DESC`)
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  const schema = db.schema;
  await schema.dropTable("session").execute();
  await schema.dropTable("file").execute();
  await schema.dropTable("lock").execute();
}
