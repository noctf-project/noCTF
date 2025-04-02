import type { Kysely } from "kysely";

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("score_history")
    .addColumn("team_id", "integer", (e) => e.notNull().references("team.id"))
    .addColumn("updated_at", "timestamptz", (e) => e.notNull())
    .addColumn("last_solve", "timestamptz", (e) => e.notNull())
    .addPrimaryKeyConstraint("score_history_pkey", ["team_id", "updated_at"])
    .addColumn("score", "integer", (e) => e.notNull())
    .execute();
  await db.schema
    .createIndex("score_history_idx_timestamp_team_id")
    .on("score_history")
    .columns(["updated_at", "team_id"])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("score_history").execute();
}
