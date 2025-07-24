import { sql, type Kysely } from "kysely";
import {
  CreateTableWithDefaultTimestamps,
  CreateTriggerUpdatedAt,
} from "./util";

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function up(db: Kysely<any>): Promise<void> {
  const schema = db.schema;

  await CreateTableWithDefaultTimestamps(schema, "user")
    .addColumn("id", "integer", (col) =>
      col.primaryKey().generatedByDefaultAsIdentity(),
    )
    .addColumn("name", "varchar(64)", (col) => col.notNull())
    .addColumn("name_normalized", "varchar(64)", (col) =>
      col
        .generatedAlwaysAs(sql`LOWER(immutable_unaccent(name))`)
        .stored()
        .unique(),
    )
    .addColumn("bio", "text", (col) => col.notNull().defaultTo(""))
    .addColumn("country", "char(2)")
    .addColumn("flags", sql`varchar[]`, (col) => col.notNull().defaultTo("{}"))
    .addColumn("roles", sql`varchar[]`, (col) => col.notNull().defaultTo("{}"))
    .execute();

  await CreateTriggerUpdatedAt("user").execute(db);
  await schema
    .createIndex("user_idx_trgm_name_normalized")
    .on("user")
    .using("gin")
    .expression(sql`name_normalized gin_trgm_ops`)
    .execute();

  await CreateTableWithDefaultTimestamps(schema, "user_identity")
    .addColumn("user_id", "integer", (col) =>
      col.notNull().references("user.id").onDelete("cascade"),
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
    .execute();
  await CreateTriggerUpdatedAt("user_identity").execute(db);

  await CreateTableWithDefaultTimestamps(schema, "oauth_provider")
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
    .execute();
  await CreateTriggerUpdatedAt("oauth_provider").execute(db);

  await schema
    .createIndex("oauth_provider_idx_is_enabled")
    .on("oauth_provider")
    .column("is_enabled")
    .execute();

  await CreateTableWithDefaultTimestamps(schema, "policy")
    .addColumn("id", "integer", (col) =>
      col.primaryKey().generatedByDefaultAsIdentity(),
    )
    .addColumn("name", "varchar(64)", (col) => col.notNull().unique())
    .addColumn("description", "text", (col) => col.notNull().defaultTo(""))
    .addColumn("permissions", sql`varchar[]`, (col) =>
      col.notNull().defaultTo("{}"),
    )
    .addColumn("public", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("is_enabled", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("match_roles", sql`varchar[]`, (col) =>
      col.notNull().defaultTo("{}"),
    )
    .addColumn("omit_roles", sql`varchar[]`, (col) =>
      col.notNull().defaultTo("{}"),
    )
    .addColumn("version", "integer", (col) => col.notNull().defaultTo(1))
    .execute();
  await CreateTriggerUpdatedAt("policy").execute(db);

  await db
    .insertInto("policy")
    .values([
      {
        name: "public",
        description: "Public user permissions",
        permissions: [
          "challenge.get",
          "team.get",
          "scoreboard.get",
          "division.get",
          "user.get",
          "announcement.get",
        ],
        public: true,
        is_enabled: true,
      },
      {
        name: "user",
        description: "Standard user permissions",
        permissions: ["*", "!admin.*", "!bypass.*"],
        match_roles: ["active"],
        is_enabled: true,
      },
      {
        name: "user_basic",
        description: "Subset of permissions for unverified users",
        permissions: ["user.self.*"],
        omit_roles: ["active"],
        is_enabled: true,
      },
      {
        name: "admin",
        description: "Administrators",
        permissions: ["*"],
        match_roles: ["admin"],
        is_enabled: true,
      },
    ])
    .execute();
  await schema
    .createIndex("role_idx_match_roles")
    .on("policy")
    .using("gin")
    .column("match_roles")
    .execute();
  await schema
    .createIndex("role_idx_public")
    .on("policy")
    .column("public")
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  const schema = db.schema;

  await schema.dropTable("policy").execute();
  await schema.dropTable("oauth_provider").execute();
  await schema.dropTable("user_identity").execute();
  await schema.dropTable("user").execute();
}
