import type { Kysely } from "kysely";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function up(db: Kysely<any>): Promise<void> {
  const schema = db.schema;

  // Drop strict cascade foreign keys so deleting teams or challenges preserves submission history
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
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function down(db: Kysely<any>): Promise<void> {
  const schema = db.schema;

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
