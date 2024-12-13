import { sql, type Kysely } from "kysely";

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function up(db: Kysely<any>): Promise<void> {
  const schema = db.schema.withSchema("core");

  await schema
    .createTable("ticket")
    .addColumn("id", "integer", (col) =>
      col.primaryKey().generatedByDefaultAsIdentity(),
    )
    .addColumn("open", "boolean", (col) => col.notNull().defaultTo(true))
    .addColumn("description", "text", (col) => col.notNull())
    .addColumn("team_id", "integer", (col) => col.references("core.team.id"))
    .addColumn("user_id", "integer", (col) => col.references("core.user.id"))
    .addColumn("challenge_id", "integer", (col) =>
      col.references("core.challenge.id"),
    )
    .addColumn("support_id", "varchar")
    .addColumn("dedupe_id", "varchar")
    .addColumn("provider", "varchar(64)", (col) => col.notNull())
    .addColumn("provider_id", "varchar(64)")
    .addColumn("created_at", "timestamp", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addCheckConstraint(
      "ticket_chk_oneof_team_user",
      sql`(team_id IS NULL OR user_id IS NULL) AND NOT (team_id IS NULL AND user_id IS NULL)`,
    )
    .addCheckConstraint(
      "ticket_chk_oneof_challenge_support",
      sql`(team_id IS NULL OR user_id IS NULL) AND NOT (team_id IS NULL AND user_id IS NULL)`,
    )
    .execute();
  await schema
    .createIndex("ticket_idx_team_id")
    .on("ticket")
    .column("team_id")
    .execute();
  await schema
    .createIndex("ticket_idx_user_id")
    .on("ticket")
    .column("user_id")
    .execute();
  await schema
    .createIndex("ticket_uidx_provider")
    .on("ticket")
    .unique()
    .columns(["provider", "provider_id"])
    .nullsNotDistinct()
    .execute();
  await schema
    .createIndex("ticket_uidx_thread")
    .unique()
    .on("core.ticket")
    .columns(["team_id", "user_id", "dedupe_id"])
    .where(sql`dedupe_id`, "is not", null)
    .execute();

  await schema
    .createTable("ticket_ban")
    .addColumn("team_id", "integer", (col) => col.references("core.team.id"))
    .addColumn("user_id", "integer", (col) => col.references("core.user.id"))
    .addColumn("until", "timestamp")
    .addColumn("reason", "text", (col) => col.notNull())
    .addColumn("created_at", "timestamp", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  const schema = db.schema.withSchema("core");

  await schema.dropTable("ticket_ban").execute();
  await schema.dropTable("ticket").execute();
}
