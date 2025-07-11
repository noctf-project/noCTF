import { sql, type Kysely } from "kysely";
import {
  CreateTableWithDefaultTimestamps,
  CreateTriggerUpdatedAt,
} from "./util";

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function up(db: Kysely<any>): Promise<void> {
  const schema = db.schema;

  await CreateTableWithDefaultTimestamps(schema, "ticket")
    .addColumn("id", "integer", (col) =>
      col.primaryKey().generatedByDefaultAsIdentity(),
    )
    .addColumn("state", "varchar(32)", (col) => col.notNull())
    .addColumn("team_id", "integer", (col) => col.references("team.id"))
    .addColumn("user_id", "integer", (col) => col.references("user.id"))
    .addColumn("assignee_id", "integer", (col) => col.references("user.id"))
    .addColumn("category", "varchar(64)")
    .addColumn("item", "varchar(64)")
    .addColumn("provider", "varchar(64)", (col) => col.notNull())
    .addColumn("provider_id", "varchar(64)")
    .addColumn("provider_metadata", "jsonb")
    .addCheckConstraint(
      "ticket_chk_oneof_team_user",
      sql`(team_id IS NULL OR user_id IS NULL) AND NOT (team_id IS NULL AND user_id IS NULL)`,
    )
    .execute();
  await CreateTriggerUpdatedAt("ticket").execute(db);

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
    .execute();
  await schema
    .createIndex("ticket_uidx_thread")
    .unique()
    .on("ticket")
    .columns(["category", "item", "team_id", "user_id"])
    .nullsNotDistinct()
    .execute();

  await CreateTableWithDefaultTimestamps(schema, "ticket_ban")
    .addColumn("team_id", "integer", (col) => col.references("team.id"))
    .addColumn("user_id", "integer", (col) => col.references("user.id"))
    .addColumn("until", "timestamptz")
    .addColumn("reason", "text", (col) => col.notNull())
    .addCheckConstraint(
      "ticket_ban_chk_oneof_team_user",
      sql`(team_id IS NULL OR user_id IS NULL) AND NOT (team_id IS NULL AND user_id IS NULL)`,
    )
    .execute();
  await CreateTriggerUpdatedAt("ticket_ban").execute(db);

  await CreateTableWithDefaultTimestamps(schema, "ticket_event", ["created_at"])
    .addColumn("ticket_id", "integer", (col) =>
      col.notNull().references("ticket.id").onDelete("cascade"),
    )
    .addColumn("operation", "varchar(64)", (col) => col.notNull())
    .addColumn("actor", "varchar(64)", (col) => col.notNull())
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  const schema = db.schema;

  await schema.dropTable("ticket_event").execute();
  await schema.dropTable("ticket_ban").execute();
  await schema.dropTable("ticket").execute();
}
