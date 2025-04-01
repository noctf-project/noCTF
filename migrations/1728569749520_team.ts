import { sql, type Kysely } from "kysely";

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function up(db: Kysely<any>): Promise<void> {
  const schema = db.schema;

  await schema
    .createTable("division")
    .addColumn("id", "integer", (col) =>
      col.primaryKey().generatedByDefaultAsIdentity(),
    )
    .addColumn("name", "varchar", (col) => col.notNull())
    .addColumn("slug", "varchar(64)", (col) => col.notNull().unique())
    .addColumn("description", "text", (col) => col.notNull())
    .addColumn("is_visible", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("is_joinable", "boolean", (col) =>
      col.notNull().defaultTo(false),
    )
    .addColumn("created_at", "timestamptz", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .execute();

  await db
    .insertInto("division")
    .values({
      name: "Default",
      slug: "default",
      description: "Default",
      is_visible: true,
      is_joinable: true,
    })
    .execute();

  await schema
    .createTable("team")
    .addColumn("id", "integer", (col) =>
      col.primaryKey().generatedByDefaultAsIdentity(),
    )
    .addColumn("name", "varchar(64)", (col) => col.notNull().unique())
    .addColumn("bio", "varchar", (col) => col.notNull().defaultTo(""))
    .addColumn("country", "char(3)")
    .addColumn("join_code", "varchar", (col) => col.unique())
    .addColumn("flags", sql`varchar[]`, (col) => col.notNull().defaultTo("{}"))
    .addColumn("division_id", sql`integer`, (col) =>
      col.notNull().references("division.id"),
    )
    .addColumn("created_at", "timestamptz", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .execute();

  await schema
    .createType("team_member_role")
    .asEnum(["member", "owner"])
    .execute();

  await schema
    .createTable("team_member")
    .addColumn("user_id", "integer", (col) =>
      col.primaryKey().references("user.id").onDelete("cascade"),
    )
    .addColumn("team_id", "integer", (col) =>
      col.notNull().references("team.id").onDelete("cascade"),
    )
    .addColumn("role", sql`team_member_role`, (col) =>
      col.notNull().defaultTo("member"),
    )
    .addColumn("created_at", "timestamptz", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .execute();
  await schema
    .createIndex("team_member_uidx_team_id_user_id")
    .on("team_member")
    .unique()
    .columns(["team_id", "user_id"])
    .execute();
  await schema
    .createIndex("team_member_uidx_team_id_role_eq_owner")
    .on("team_member")
    .unique()
    .column("team_id")
    .where(sql`role`, "=", "owner")
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  const schema = db.schema;

  await schema.dropTable("team_member").execute();
  await schema.dropType("team_member_role").execute();
  await schema.dropTable("team").execute();
  await schema.dropTable("division").execute();
}
