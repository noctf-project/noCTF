import { sql } from "kysely";

// IMPORTANT: do not modify these in a way that will affect the schema, the previous migrations
// depend on it.

export const CreateTriggerUpdatedAt = (
  table: string,
) => sql`CREATE TRIGGER ${sql.ref(`${table}_updated_at`)}
BEFORE UPDATE ON ${sql.ref(table)}
FOR EACH ROW EXECUTE PROCEDURE trigger_updated_at()`;
