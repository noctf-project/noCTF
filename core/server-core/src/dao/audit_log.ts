import type { QueryAuditLogRequest } from "@noctf/api/requests";
import type { DBType } from "../clients/database.ts";
import { sql } from "kysely";
import type { AuditLogEntry } from "@noctf/api/datatypes";

const MAX_QUERY_LIMIT = 100;

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

  async query({
    start_time,
    end_time,
    actor,
    entities,
    operation,
    offset,
    limit,
  }: QueryAuditLogRequest): Promise<AuditLogEntry[]> {
    let query = this.db
      .selectFrom("audit_log")
      .select(["actor", "operation", "entities", "data", "created_at"]);

    if (start_time) {
      query = query.where("created_at", ">=", start_time);
    }
    if (end_time) {
      query = query.where("created_at", "<=", end_time);
    }
    if (actor) {
      query = query.where("actor", "=", actor);
    }
    if (entities && entities.length) {
      query = query.where(
        "entities",
        "&&",
        sql<string[]>`ARRAY[${sql.join(entities)}]`,
      );
    }
    if (operation) {
      query = query.where("operation", "like", operation);
    }
    if (!limit || limit > MAX_QUERY_LIMIT) {
      query = query.limit(MAX_QUERY_LIMIT);
    } else {
      query = query.limit(limit);
    }

    return query
      .orderBy("created_at desc")
      .offset(offset || 0)
      .execute();
  }
}
