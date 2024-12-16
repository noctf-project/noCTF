import { sql, type Kysely } from "kysely";

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function up(db: Kysely<any>): Promise<void> {
  const schema = db.schema.withSchema("core");

  await schema
    .createTable("user")
    .addColumn("id", "integer", (col) =>
      col.primaryKey().generatedByDefaultAsIdentity(),
    )
    .addColumn("name", "varchar(64)", (col) => col.unique())
    .addColumn("bio", "text", (col) => col.notNull().defaultTo(""))
    .addColumn("flags", sql`varchar[]`, (col) => col.notNull().defaultTo("{}"))
    .addColumn("created_at", "timestamp", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .execute();

  await schema
    .createTable("user_identity")
    .addColumn("user_id", "integer", (col) =>
      col.notNull().references("core.user.id").onDelete("cascade"),
    )
    .addColumn("provider", "varchar(64)", (col) => col.notNull())
    .addColumn("provider_id", "varchar", (col) => col.notNull())
    .addColumn("secret_data", "varchar")
    .addUniqueConstraint("user_identity_uidx_user_id_provider", [
      "user_id",
      "provider",
    ])
    .addUniqueConstraint("user_identity_uidx_provider_provider_id", [
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

  await schema
    .createTable("role")
    .addColumn("id", "integer", (col) =>
      col.primaryKey().generatedByDefaultAsIdentity(),
    )
    .addColumn("name", "varchar(64)", (col) => col.unique())
    .addColumn("description", "text", (col) => col.notNull().defaultTo(""))
    .addColumn("permissions", sql`varchar[]`, (col) =>
      col.notNull().defaultTo("{}"),
    )
    .addColumn("public", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("match_flags", sql`varchar[]`, (col) => col.notNull().defaultTo('{}'))
    .addColumn("omit_flags", sql`varchar[]`, (col) => col.notNull().defaultTo('{}'))
    .execute();
  await db
    .withSchema("core")
    .insertInto("role")
    .values([
      {
        name: "public",
        description: "Public user permissions",
        permissions: [":r", "!user.me", "!admin"],
        public: true
      },
      {
        name: "user",
        description: "Standard user permissions",
        permissions: ["", "!admin"],
        omit_flags: ["blocked"]
      },
      {
        name: "user_blocked",
        description: "Subset of permissions for blocked users",
        permissions: ["!"],
      },
      {
        name: "admin",
        description: "Administrators",
        permissions: ["admin"],
        match_flags: ["admin"]
      },
    ])
    .execute();
  await schema
    .createIndex("role_idx_match_flags")
    .on("role")
    .using("gin")
    .column("match_flags")
    .execute();
  await schema
    .createIndex("role_idx_public")
    .on("role")
    .column("public")
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  const schema = db.schema.withSchema("core");

  await schema.dropTable("role").execute();
  await schema.dropTable("oauth_provider").execute();
  await schema.dropTable("user_identity").execute();
  await schema.dropTable("user").execute();
}
