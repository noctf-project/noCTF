import { sql, type Kysely } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
	const schema = db.schema.withSchema("core");

  await schema
    .createTable("audit_log")
    .addColumn("actor", "varchar(64)", (col) => col.notNull())
    .addColumn("operation", "varchar(64)", (col) => col.notNull())
    .addColumn("entities", sql`text[]`, (col) => col.notNull())
    .addColumn("data", "text")
    .addColumn("created_at", "timestamp", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .execute();
  await schema
    .createIndex("idx_created_at_actor")
    .on("audit_log")
    .expression(sql`created_at DESC, actor`)
    .execute();
  await schema
    .createIndex("idx_created_at_operation")
    .on("audit_log")
    .expression(sql`created_at DESC, operation`)
    .execute();
  await schema
    .createIndex("idx_created_at_entity")
    .on("audit_log")
    .expression(sql`created_at DESC, entities`)
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	const schema = db.schema.withSchema("core");

  await schema.dropTable("audit_log").execute();
}
