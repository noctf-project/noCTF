import { sql, type Kysely } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  const schema = db.schema.withSchema("core");

  await schema.createTable("challenge")
    .addColumn("id", "integer", (col) =>
      col.primaryKey().generatedByDefaultAsIdentity(),
    )
    .addColumn("name", "varchar", (col) => col.notNull())
    .addColumn("slug", "varchar(64)", (col) => col.notNull().unique())
    .addColumn("created_at", "timestamp", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addColumn("data", "json", (col) => col.notNull())
    .addColumn("tags", sql`hstore`, (col) => col.notNull().defaultTo(""))
    .addColumn("hidden", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("visible_at", "timestamp")
    .execute();

  await schema.createTable("submission")
    .addColumn("id", "integer", (col) =>
      col.primaryKey().generatedByDefaultAsIdentity(),
    )
    .addColumn("user_id", "integer", (col) =>
      col.notNull().references("core.user.id").onDelete("cascade"),
    )
    .addColumn("team_id", "integer", (col) =>
      col.notNull().references("core.team.id").onDelete("cascade"),
    )
    .addColumn("challenge_id", "integer", (col) =>
      col.notNull().references("core.challenge.id").onDelete("cascade"),
    )
    .addColumn("created_at", "timestamp", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addColumn("data", "text", (col) => col.notNull())
    .addColumn("solved", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("pending", "boolean", (col) => col.notNull().defaultTo(false))
    .execute();

  await schema.createIndex("uidx_submission_solved")
    .on("submission")
    .unique()
    .columns(["team_id", "challenge_id"])
    .where(sql`solved`, "=", true)
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  const schema = db.schema.withSchema("core");
  
  await schema.dropTable("submission").execute();
  await schema.dropTable("challenge").execute(); 
}
