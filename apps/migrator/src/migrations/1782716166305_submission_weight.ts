import { type Kysely } from "kysely";
import { CreateTableWithDefaultTimestamps } from "../util.ts";

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function up(db: Kysely<any>): Promise<void> {
  const schema = db.schema;

  await schema
    .alterTable("submission")
    .dropConstraint("submission_team_id_fkey")
    .execute();
  await schema
    .alterTable("submission")
    .dropConstraint("submission_challenge_id_fkey")
    .execute();
  await schema
    .alterTable("submission")
    .dropConstraint("submission_user_id_fkey")
    .execute();
  await schema
    .alterTable("score_history")
    .dropConstraint("score_history_team_id_fkey")
    .execute();
  await schema
    .createIndex("submission_idx_updated_at")
    .on("submission")
    .column("updated_at")
    .execute();

  await schema.dropTable("submission_log").execute();

  await CreateTableWithDefaultTimestamps(schema, "submission_weight", [
    "created_at",
  ])
    .addColumn("challenge_id", "integer", (col) => col.notNull())
    .addColumn("team_id", "integer", (col) => col.notNull())
    .addColumn("weight", "integer", (col) => col.notNull())
    .addPrimaryKeyConstraint("submission_weight_pkey", [
      "challenge_id",
      "team_id",
      "created_at",
    ])
    .execute();

  await schema
    .createIndex("submission_weight_idx_created_at")
    .on("submission_weight")
    .column("created_at")
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  const schema = db.schema;
  await schema.dropTable("submission_weight").execute();
  await CreateTableWithDefaultTimestamps(schema, "submission_log", [
    "created_at",
  ])
    .addColumn("id", "bigint", (col) =>
      col.primaryKey().generatedByDefaultAsIdentity(),
    )
    .addColumn("submission_id", "integer", (col) =>
      col.references("submission.id").onDelete("cascade"),
    )
    .addColumn("actor", "varchar(64)", (col) => col.notNull())
    .addColumn("comments", "text", (col) => col.notNull().defaultTo(""))
    .addColumn("changes", "jsonb", (col) => col.notNull().defaultTo("{}"))
    .execute();

  await schema.dropIndex("submission_idx_updated_at").execute();

  await schema
    .alterTable("submission")
    .addForeignKeyConstraint("submission_team_id_fkey", ["team_id"], "team", [
      "id",
    ])
    .onDelete("cascade")
    .execute();

  await schema
    .alterTable("submission")
    .addForeignKeyConstraint(
      "submission_challenge_id_fkey",
      ["challenge_id"],
      "challenge",
      ["id"],
    )
    .onDelete("cascade")
    .execute();

  await schema
    .alterTable("submission")
    .addForeignKeyConstraint("submission_user_id_fkey", ["user_id"], "user", [
      "id",
    ])
    .onDelete("set null")
    .execute();

  await schema
    .alterTable("score_history")
    .addForeignKeyConstraint(
      "score_history_team_id_fkey",
      ["team_id"],
      "team",
      ["id"],
    )
    .onDelete("cascade")
    .execute();
}
