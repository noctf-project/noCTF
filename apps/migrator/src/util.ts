import { sql, CreateTableBuilder, SchemaModule } from "kysely";

// IMPORTANT: do not modify these in a way that will affect the schema, the previous migrations
// depend on it.

export const CreateTriggerUpdatedAt = (
  table: string,
) => sql`CREATE TRIGGER ${sql.ref(`${table}_updated_at`)}
BEFORE UPDATE ON ${sql.ref(table)}
FOR EACH ROW EXECUTE PROCEDURE trigger_updated_at()`;

export function CreateTableWithDefaultTimestamps<T extends string>(
  schema: SchemaModule,
  table: T,
): CreateTableBuilder<T, "created_at" | "updated_at">;
export function CreateTableWithDefaultTimestamps<
  T extends string,
  const S extends readonly string[],
>(schema: SchemaModule, table: T, columns: S): CreateTableBuilder<T, S[number]>;
export function CreateTableWithDefaultTimestamps<
  T extends string,
  S extends readonly string[],
>(
  schema: SchemaModule,
  table: T,
  columns?: S,
):
  | CreateTableBuilder<T, S[number]>
  | CreateTableBuilder<T, "created_at" | "updated_at"> {
  const derived = columns ?? (["created_at", "updated_at"] as const);
  let tbl = schema.createTable(table);
  for (const column of derived) {
    tbl = tbl.addColumn(column, "timestamptz", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    );
  }

  return tbl;
}
