import type { QueryAuditLogRequest } from "@noctf/api/requests";
import type { DBType } from "../clients/database.ts";
import { sql } from "kysely";
import type { AuditLogEntry, LimitOffset } from "@noctf/api/datatypes";

export class AuditLogDAO {
  constructor(private readonly db: DBType) {}
  async create({
    operation,
    actor,
    entities,
    data,
  }: Pick<AuditLogEntry, "actor" | "data" | "operation" | "entities">) {
    return this.db
      .insertInto("audit_log")
      .values({
        actor,
        operation,
        entities,
        data,
      })
      .execute();
  }

  async query(
    {
      created_at,
      actor,
      entities,
      operation,
    }: Omit<QueryAuditLogRequest, "limit|offset">,
    limit?: LimitOffset,
  ): Promise<AuditLogEntry[]> {
    let query = this.db
      .selectFrom("audit_log")
      .select(["actor", "operation", "entities", "data", "created_at"]);

    if (created_at) {
      if (created_at[0]) query = query.where("created_at", ">=", created_at[0]);
      if (created_at[1]) query = query.where("created_at", "<=", created_at[1]);
    }

    if (actor && actor.length) {
      query = query.where("actor", "in", actor);
    }
    if (entities && entities.length) {
      query = query.where(
        "entities",
        "&&",
        sql<string[]>`ARRAY[${sql.join(entities)}]`,
      );
    }
    if (operation && operation.length) {
      query = query.where("operation", "in", operation);
    }
    if (limit?.limit) {
      query = query.limit(limit.limit);
    }

    return query
      .orderBy("created_at desc")
      .offset(limit?.offset || 0)
      .execute();
  }
}
