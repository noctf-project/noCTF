import { sql, type Kysely } from "kysely";

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema.createSchema("core").execute();

  const schema = db.schema.withSchema("core");

  await schema
    .createTable("config")
    .addColumn("namespace", "varchar", (col) => col.primaryKey())
    .addColumn("data", "varchar", (col) => col.notNull().defaultTo("{}"))
    .addColumn("created_at", "timestamp", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addColumn("updated_at", "timestamp", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  const schema = db.schema.withSchema("core");

  await schema.dropTable("config").execute();

  await db.schema.dropSchema("core").execute();
}
