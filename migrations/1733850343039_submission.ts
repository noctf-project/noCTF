import { sql, type Kysely } from "kysely";

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function up(db: Kysely<any>): Promise<void> {
  const schema = db.schema;

  await schema
    .createType("submission_status")
    .asEnum(["queued", "incorrect", "correct", "invalid"])
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
      col.notNull().references("team.id").onDelete("cascade"),
    )
    .addColumn("challenge_id", "integer", (col) =>
      col.notNull().references("challenge.id"),
    )
    .addColumn("data", "text")
    .addColumn("comments", "text")
    .addColumn("source", "varchar(64)", (col) => col.notNull())
    .addColumn("hidden", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("status", sql`submission_status`, (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addColumn("updated_at", "timestamptz", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .execute();

  await schema
    .createIndex("submission_idx_status_team_id")
    .on("submission")
    .columns(["status", "team_id"])
    .execute();

  await schema
    .createIndex("submission_idx_status_challenge_id")
    .on("submission")
    .columns(["status", "challenge_id"])
    .execute();

  await schema
    .createIndex("submission_uidx_queued_solved")
    .on("submission")
    .unique()
    .columns(["challenge_id", "team_id"])
    .where(sql`status`, "in", sql`('queued', 'correct')`)
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
        .where("status", "=", "correct")
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
  await schema.dropType("submission_status").execute();
}
