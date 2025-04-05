import { sql, type Kysely } from "kysely";

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function up(db: Kysely<any>): Promise<void> {
  const schema = db.schema;

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
      col.references("user.id").onDelete("no action"),
    )
    .addColumn("team_id", "integer", (col) =>
      col.notNull().references("team.id"),
    )
    .addColumn("challenge_id", "integer", (col) =>
      col.notNull().references("challenge.id"),
    )
    .addColumn("data", "text")
    .addColumn("comments", "text")
    .addColumn("source", "varchar(64)", (col) => col.notNull())
    .addColumn("hidden", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("queued", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("solved", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("created_at", "timestamptz", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addColumn("updated_at", "timestamptz", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addCheckConstraint(
      "submission_chk_oneof_queued_solved",
      sql`NOT (queued IS TRUE AND solved IS TRUE)`,
    )
    .execute();
  await schema
    .createIndex("submission_idx_challenge_id_solved")
    .on("submission")
    .columns(["solved", "challenge_id", "team_id"])
    .execute();
  await schema
    .createIndex("submission_idx_queued_challenge_id")
    .on("submission")
    .columns(["queued", "challenge_id"])
    .execute();

  await schema
    .createIndex("submission_uidx_queued_solved")
    .on("submission")
    .unique()
    .columns(["challenge_id", "team_id"])
    .where((eb) =>
      eb.or([eb(sql`queued`, "=", "true"), eb(sql`solved`, "=", "true")]),
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
      "division_id",
      "team_flags",
      "created_at",
    ])
    .as(
      db
        .selectFrom("submission")
        .select([
          "submission.id",
          "hidden",
          "challenge_id",
          "team_id",
          "division_id",
          "team.flags",
          "submission.created_at",
        ])
        .where("solved", "=", true)
        .innerJoin("team", "team.id", "submission.team_id"),
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
      col.notNull().references("team.id").onDelete("cascade"),
    )
    .addColumn("created_at", "timestamptz", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  const schema = db.schema;

  await schema.dropTable("award").execute();
  await schema.dropView("solve").execute();
  await schema.dropTable("submission").execute();
  await schema.dropTable("challenge").execute();
}
