import { sql, type Kysely } from "kysely";

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function up(db: Kysely<any>): Promise<void> {
  const schema = db.schema.withSchema("core");

  await schema
    .createTable("team")
    .addColumn("id", "integer", (col) =>
      col.primaryKey().generatedByDefaultAsIdentity(),
    )
    .addColumn("name", "varchar(64)", (col) => col.unique())
    .addColumn("bio", "varchar", (col) => col.notNull().defaultTo(""))
    .addColumn("join_code", "varchar", (col) => col.unique().nullsNotDistinct())
    .addColumn("flags", sql`varchar[]`, (col) => col.notNull().defaultTo("{}"))
    .addColumn("created_at", "timestamp", (col) =>
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
      col.primaryKey().references("core.user.id").onDelete("cascade"),
    )
    .addColumn("team_id", "integer", (col) =>
      col.notNull().references("core.team.id").onDelete("cascade"),
    )
    .addColumn("role", sql`core.team_member_role`, (col) =>
      col.notNull().defaultTo("member"),
    )
    .addColumn("created_at", "timestamp", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .execute();
  await schema.createIndex("team_member_uidx_team_id_role_eq_owner")
    .on("team_member")
    .unique()
    .column("team_id")
    .where(sql`role`, "=", "owner")
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  const schema = db.schema.withSchema("core");

  await schema.dropTable("team_member").execute();
  await schema.dropType("team_member_role").execute();
  await schema.dropTable("team").execute();
}
