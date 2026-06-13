import { sql, type Kysely } from "kysely";
import { CreateTableWithDefaultTimestamps } from "../util";
import { jsonBuildObject } from "kysely/helpers/postgres";

export async function up(db: Kysely<any>): Promise<void> {
  const schema = db.schema;
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

  await schema
    .createIndex("submission_log_idx_created_at")
    .on("submission_log")
    .expression(sql`created_at`)
    .execute();
  await schema
    .createIndex("submission_log_idx_submission_id_created_at")
    .on("submission_log")
    .expression(sql`submission_id, created_at DESC`)
    .execute();
  await schema
    .createIndex("submission_log_idx_actor_created_at")
    .on("submission_log")
    .expression(sql`actor, created_at DESC`)
    .execute();

  // move comments into submission_logs
  await db
    .insertInto("submission_log")
    .columns(["submission_id", "created_at", "actor", "comments", "changes"])
    .expression((e) =>
      e.selectFrom("submission").select([
        "id",
        "updated_at",
        sql<string>`'user:' || ${e.ref("user_id")}`.as("actor"),
        "comments",
        jsonBuildObject({
          status: e.ref("status"),
          hidden: e.ref("hidden"),
          value: e.ref("value"),
        }).as("changes"),
      ]),
    )
    .execute();
  await schema.alterTable("submission").dropColumn("comments").execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  const schema = db.schema;

  await schema
    .alterTable("submission")
    .addColumn("comments", "text", (col) => col.notNull().defaultTo(""))
    .execute();

  // restore the latest comment into the submission_log table, disable triggers
  // so the updated_at timestamp doesn't change.
  // we don't need to unset this as the whole migration is run in a transaction
  await sql`SET LOCAL session_replication_role = 'replica'`.execute(db);
  await db
    .updateTable("submission")
    .from((eb) =>
      eb
        .selectFrom("submission_log")
        .distinctOn("submission_id")
        .select(["submission_id", "comments"])
        .orderBy("submission_id")
        .orderBy("created_at", "desc")
        .as("latest_log"),
    )
    .set((eb) => ({
      comments: eb.ref("latest_log.comments"),
    }))
    .whereRef("submission.id", "=", "latest_log.submission_id")
    .execute();

  await schema.dropTable("submission_log").execute();
}
