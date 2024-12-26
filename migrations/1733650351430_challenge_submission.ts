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
    .addColumn("version", "integer", (col) => col.notNull().defaultTo(1))
    .addColumn("visible_at", "timestamptz")
    .addColumn("created_at", "timestamptz", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addColumn("updated_at", "timestamptz", (col) =>
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
    .addColumn("hidden", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("pending", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("solved", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("created_at", "timestamptz", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addColumn("updated_at", "timestamptz", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addCheckConstraint(
      "submission_chk_oneof_pending_solved",
      sql`NOT (pending IS TRUE AND solved IS TRUE)`,
    )
    .execute();
  await schema
    .createIndex("submission_idx_challenge_id_solved")
    .on("submission")
    .columns(["challenge_id", "solved"])
    .execute();
  await schema
    .createIndex("submission_idx_team_id_solved")
    .on("submission")
    .columns(["team_id", "solved"])
    .execute();

  await schema
    .createIndex("submission_uidx_pending_solved")
    .on("submission")
    .unique()
    .columns(["team_id", "challenge_id"])
    .where((eb) =>
      eb.or([eb(sql`pending`, "=", "true"), eb(sql`solved`, "=", "true")]),
    )
    .execute();

  await schema
    .createIndex("submission_idx_created_at_challenge_id")
    .on("submission")
    .expression(sql`created_at DESC, challenge_id`)
    .execute();

  await schema
    .createView("solve")
    .columns([
      "id",
      "hidden",
      "challenge_id",
      "team_id",
      "created_at",
      "team_flags",
    ])
    .as(
      db
        .selectFrom("core.submission")
        .select([
          "core.submission.id",
          "hidden",
          "challenge_id",
          "team_id",
          "core.submission.created_at",
          "core.team.flags",
        ])
        .where("solved", "=", true)
        .innerJoin("core.team", "core.team.id", "core.submission.team_id"),
    )
    .execute();

  await schema
    .createTable("award")
    .addColumn("id", "integer", (col) =>
      col.primaryKey().generatedAlwaysAsIdentity(),
    )
    .addColumn("value", "integer")
    .addColumn("title", "varchar(128)", (col) => col.notNull())
    .addColumn("team_id", "integer", (col) =>
      col.notNull().references("core.team.id").onDelete("cascade"),
    )
    .addColumn("created_at", "timestamptz", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  const schema = db.schema.withSchema("core");

  await schema.dropTable("award").execute();
  await schema.dropView("solve").execute();
  await schema.dropTable("submission").execute();
  await schema.dropTable("challenge").execute();
}
