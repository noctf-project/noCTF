import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  const schema = db.schema.withSchema("core");

  await schema
    .createTable("team")
    .addColumn("id", "integer", (col) =>
      col.primaryKey().generatedByDefaultAsIdentity(),
    )
    .addColumn("name", "varchar(64)", (col) => col.unique())
    .addColumn("bio", "varchar", (col) => col.notNull().defaultTo(""))
    .addColumn("password", "varchar")
    .addColumn("is_blocked", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("is_hidden", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("created_at", "timestamp", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .execute();

  await schema
    .createType("team_member_role")
    .asEnum(["pending", "member", "admin"])
    .execute();

  await schema
    .createTable("team_member")
    .addColumn("user_id", "integer", (col) =>
      col.primaryKey().references("core.user.id"),
    )
    .addColumn("team_id", "integer", (col) =>
      col.notNull().references("core.team.id"),
    )
    .addColumn("role", sql`core.team_member_role`, (col) =>
      col.notNull().defaultTo("member"),
    )
    .addColumn("created_at", "timestamp", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  const schema = db.schema.withSchema("core");

  await schema.dropTable("team_member").execute();
  await schema.dropType("team_member_role").execute();
  await schema.dropTable("team").execute();
}
