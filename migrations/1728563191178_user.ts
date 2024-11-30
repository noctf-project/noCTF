import { sql, type Kysely } from "kysely";

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function up(db: Kysely<any>): Promise<void> {
  const schema = db.schema.withSchema("core");
  const schemaData = db.withSchema("core");

  await schema
    .createTable("user")
    .addColumn("id", "integer", (col) =>
      col.primaryKey().generatedByDefaultAsIdentity(),
    )
    .addColumn("name", "varchar(64)", (col) => col.unique())
    .addColumn("bio", "varchar", (col) => col.notNull().defaultTo(""))
    .addColumn("flags", sql`varchar[]`, (col) => col.notNull().defaultTo("{}"))
    .addColumn("created_at", "timestamp", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .execute();

  await schema
    .createTable("group")
    .addColumn("id", "integer", (col) =>
      col.primaryKey().generatedByDefaultAsIdentity(),
    )
    .addColumn("name", "varchar(64)", (col) => col.unique())
    .addColumn("description", "varchar")
    .addColumn("created_at", "timestamp", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .execute();

  await schemaData
    .insertInto("group")
    .values([
      {
        name: "valid_email",
        description: "Users with a validated email address",
      },
      {
        name: "admin",
        description: "Users with full admin privileges",
      },
    ])
    .execute();

  await schema
    .createTable("user_group")
    .addColumn("user_id", "integer", (col) =>
      col.notNull().references("core.user.id").onDelete("cascade"),
    )
    .addColumn("group_id", "integer", (col) =>
      col.notNull().references("core.group.id").onDelete("cascade"),
    )
    .addColumn("created_at", "timestamp", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addPrimaryKeyConstraint("user_group_pkey", ["user_id", "group_id"])
    .execute();

  await schema
    .createTable("user_identity")
    .addColumn("user_id", "integer", (col) =>
      col.notNull().references("core.user.id").onDelete("cascade"),
    )
    .addColumn("provider", "varchar(64)", (col) => col.notNull())
    .addColumn("provider_id", "varchar", (col) => col.notNull())
    .addColumn("secret_data", "varchar")
    .addUniqueConstraint("uidx_user_id_provider_idx", ["user_id", "provider"])
    .addUniqueConstraint("uidx_provider_provider_id_idx", [
      "provider",
      "provider_id",
    ])
    .addColumn("created_at", "timestamp", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .execute();

  await schema
    .createTable("oauth_provider")
    .addColumn("id", "integer", (col) =>
      col.primaryKey().generatedByDefaultAsIdentity(),
    )
    .addColumn("name", "varchar(56)", (col) => col.notNull().unique())
    .addColumn("is_enabled", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("is_registration_enabled", "boolean", (col) =>
      col.notNull().defaultTo(false),
    )
    .addColumn("client_id", "varchar", (col) => col.notNull())
    .addColumn("client_secret", "varchar", (col) => col.notNull())
    .addColumn("image_src", "varchar")
    .addColumn("authorize_url", "varchar", (col) => col.notNull())
    .addColumn("token_url", "varchar", (col) => col.notNull())
    .addColumn("info_url", "varchar", (col) => col.notNull())
    .addColumn("info_id_property", "varchar")
    .addColumn("created_at", "timestamp", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .execute();

  await schema
    .createIndex("oauth_provider_idx_is_enabled")
    .on("oauth_provider")
    .column("is_enabled")
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  const schema = db.schema.withSchema("core");

  await schema.dropIndex("oauth_provider_idx_is_enabled").execute();
  await schema.dropTable("oauth_provider").execute();
  await schema.dropTable("user_identity").execute();
  await schema.dropTable("user_group").execute();
  await schema.dropTable("group").execute();
  await schema.dropTable("user").execute();
}
