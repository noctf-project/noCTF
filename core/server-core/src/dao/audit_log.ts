import type { QueryAuditLogRequest } from "@noctf/api/requests";
import type { DBType } from "../clients/database.ts";
import { sql } from "kysely";
import type { AuditLogEntry, LimitOffset } from "@noctf/api/datatypes";
import { LimitCursorDecoded } from "../types/pagination.ts";

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
    params?: Parameters<AuditLogDAO["listQuery"]>[0],
    limit?: number,
  ): Promise<AuditLogEntry[]> {
    let query = this.listQuery(params).select([
      "actor",
      "operation",
      "entities",
      "data",
      "created_at",
    ]);

    if (limit) {
      query = query.limit(limit);
    }
    return query.orderBy("created_at desc").execute();
  }

  async getCount(
    params?: Parameters<AuditLogDAO["listQuery"]>[0],
  ): Promise<number> {
    return Number(
      (
        await this.listQuery(params)
          .select(this.db.fn.countAll().as("count"))
          .executeTakeFirstOrThrow()
      ).count,
    );
  }

  private listQuery({
    created_at,
    actor,
    entities,
    operation,
  }: Omit<QueryAuditLogRequest, "page_size"> = {}) {
    let query = this.db.selectFrom("audit_log");

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
      query = query.where("operation", "like", operation);
    }
    return query;
  }
}
