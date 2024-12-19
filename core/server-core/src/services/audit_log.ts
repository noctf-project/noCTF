import type { AuditLogEntry } from "@noctf/api/datatypes";
import type { QueryAuditLogRequest } from "@noctf/api/requests";
import { ServiceCradle } from "../index.ts";
import { AuditLogActor } from "../types/audit_log.ts";
import { sql } from "kysely";

const MAX_QUERY_LIMIT = 100;
type Props = Pick<ServiceCradle, "databaseClient">;

export class AuditLogService {
  private readonly databaseClient: Props["databaseClient"];

  constructor({ databaseClient }: Props) {
    this.databaseClient = databaseClient;
  }

  async log({
    operation,
    actor: { type, id },
    entities = [],
    data,
  }: {
    operation: string;
    actor: AuditLogActor;
    entities?: string[];
    data?: string;
  }) {
    await this.databaseClient
      .get()
      .insertInto("core.audit_log")
      .values({
        actor: id ? `${type}:${id}` : type,
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
    let query = this.databaseClient
      .get()
      .selectFrom("core.audit_log")
      .select(["actor", "operation", "entities", "data", "created_at"]);

    if (start_time) {
      query = query.where("created_at", ">=", new Date(start_time * 1000));
    }
    if (end_time) {
      query = query.where("created_at", "<=", new Date(end_time * 1000));
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

    return (
      await query
        .orderBy("created_at desc")
        .offset(offset || 0)
        .limit(limit > MAX_QUERY_LIMIT ? MAX_QUERY_LIMIT : limit)
        .execute()
    ).map((e) => ({
      ...e,
      created_at: Math.floor(e.created_at.getTime() / 1000),
    }));
  }
}
