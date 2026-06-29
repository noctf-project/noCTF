import type { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  const schema = db.schema;
  await schema
    .alterTable("submission")
    .addColumn("weight", "integer", (c) => c.notNull().defaultTo(0))
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  const schema = db.schema;
  await schema.alterTable("submission").dropColumn("weight").execute();
}
