import { sql, type Kysely } from "kysely";
import { CreateTriggerUpdatedAt } from "./util";

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
    .addColumn("mime", "varchar(255)", (col) => col.notNull())
    .addColumn("size", "bigint", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .execute();

  await schema
    .createTable("app")
    .addColumn("id", "integer", (col) =>
      col.primaryKey().generatedByDefaultAsIdentity(),
    )
    .addColumn("name", "varchar(64)", (col) => col.notNull())
    .addColumn("client_id", "varchar(128)", (col) => col.notNull().unique())
    .addColumn("client_secret_hash", sql`bytea`)
    .addColumn("redirect_uris", sql`varchar[]`, (col) =>
      col.notNull().defaultTo("{}"),
    )
    .addColumn("scopes", sql`varchar[]`, (col) => col.notNull().defaultTo("{}"))
    .addColumn("enabled", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("created_at", "timestamptz", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addColumn("updated_at", "timestamptz", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .execute();

  await CreateTriggerUpdatedAt("app").execute(db);

  await schema
    .createTable("session")
    .addColumn("id", "integer", (col) =>
      col.primaryKey().generatedByDefaultAsIdentity(),
    )
    .addColumn("refresh_token_hash", "bytea", (col) => col.unique())
    .addColumn("user_id", "integer", (col) =>
      col.notNull().references("user.id").onDelete("cascade"),
    )
    .addColumn("scopes", sql`varchar[]`)
    .addColumn("ip", "varchar(64)")
    .addColumn("app_id", "integer", (col) => col.references("app.id"))
    .addColumn("revoked_at", "timestamptz")
    .addColumn("created_at", "timestamptz", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addColumn("refreshed_at", "timestamptz", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addColumn("expires_at", "timestamptz")
    .execute();
  await schema
    .createIndex("session_idx_user_id_created_at")
    .on("session")
    .columns(["created_at", "user_id"])
    .execute();
  await schema
    .createIndex("session_idx_user_id_app_id_revoked_at")
    .on("session")
    .columns(["user_id", "app_id", "revoked_at"])
    .execute();
  await schema
    .createIndex("session_idx_expires_at")
    .on("session")
    .columns(["expires_at"])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  const schema = db.schema;
  await schema.dropTable("session").execute();
  await schema.dropTable("app").execute();
  await schema.dropTable("file").execute();
  await schema.dropTable("lock").execute();
}
