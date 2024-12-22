import { sql, type Kysely } from "kysely";

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function up(db: Kysely<any>): Promise<void> {
  const schema = db.schema.withSchema("core");

  await schema
    .createTable("challenge")
    .addColumn("id", "integer", (col) =>
      col.primaryKey().generatedByDefaultAsIdentity(),
    )
    .addColumn("slug", "varchar(64)", (col) => col.notNull().unique())
    .addColumn("title", "varchar(128)", (col) => col.notNull())
    .addColumn("description", "text", (col) => col.notNull())
    .addColumn("private_metadata", "jsonb", (col) => col.notNull())
    .addColumn("tags", "jsonb", (col) => col.notNull().defaultTo("{}"))
    .addColumn("hidden", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("visible_at", "timestamp")
    .addColumn("created_at", "timestamp", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addColumn("updated_at", "timestamp", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .execute();
  await schema
    .createIndex("challenge_idx_tags")
    .on("challenge")
    .using("gin")
    .column("tags")
    .execute();
  await schema
    .createIndex("challenge_idx_hidden_visible_at")
    .on("challenge")
    .columns(["hidden", "visible_at"])
    .execute();

  await schema
    .createTable("submission")
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
    .addColumn("data", "text")
    .addColumn("comments", "text")
    .addColumn("pending", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("created_at", "timestamp", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addColumn("updated_at", "timestamp", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .execute();
  await schema
    .createIndex("submission_uidx_pending")
    .on("submission")
    .unique()
    .columns(["team_id", "challenge_id", "pending"])
    .where("pending", "=", "true")
    .execute();

  await schema
    .createIndex("submission_idx_created_at_challenge_id")
    .on("submission")
    .expression(sql`created_at DESC, challenge_id`)
    .execute();

  await schema
    .createTable("solve")
    .addColumn("id", "integer", (col) =>
      col.primaryKey().references("core.submission.id").onDelete("cascade"),
    )
    .addColumn("value", "integer")
    .addColumn("challenge_id", "integer", (col) =>
      col.notNull().references("core.challenge.id").onDelete("cascade"),
    )
    .addColumn("team_id", "integer", (col) =>
      col.notNull().references("core.team.id").onDelete("cascade"),
    )
    .addColumn("created_at", "timestamp", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addUniqueConstraint("uidx_challenge_id_team_id", [
      "challenge_id",
      "team_id",
    ])
    .execute();

  await schema
    .createTable("award")
    .addColumn("id", "integer", (col) =>
      col.primaryKey().generatedAlwaysAsIdentity(),
    )
    .addColumn("value", "integer")
    .addColumn("title", "varchar(128)", (col) => col.notNull())
    .addColumn("challenge_id", "integer", (col) =>
      col.references("core.challenge.id").onDelete("cascade"),
    )
    .addColumn("solve_id", "integer", (col) =>
      col.references("core.solve.id").onDelete("cascade"),
    )
    .addColumn("team_id", "integer", (col) =>
      col.notNull().references("core.team.id").onDelete("cascade"),
    )
    .addColumn("created_at", "timestamp", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addCheckConstraint(
      "award_chk_solve_has_challenge",
      sql`(solve_id IS NULL) OR (solve_id IS NOT NULL AND challenge_id IS NOT NULL)`,
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  const schema = db.schema.withSchema("core");

  await schema.dropTable("award").execute();
  await schema.dropTable("solve").execute();
  await schema.dropTable("submission").execute();
  await schema.dropTable("challenge").execute();
}
