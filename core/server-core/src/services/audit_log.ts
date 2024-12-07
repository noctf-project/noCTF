import type { AuditLogEntry } from "@noctf/api/datatypes";
import type { QueryAuditLogRequest } from "@noctf/api/requests";
import { ServiceCradle } from "../index.ts";
import { AuditLogActor } from "../types/audit_log.ts";

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
    entity,
    data,
  }: {
    operation: string;
    actor: AuditLogActor;
    entity?: string;
    data?: string;
  }) {
    await this.databaseClient
      .insertInto("core.audit_log")
      .values({
        actor: id ? `${type}:${id}` : type,
        operation,
        entity,
        data,
      })
      .execute();
  }

  async query({
    start_time,
    end_time,
    actor,
    entity,
    operation,
    offset,
    limit,
  }: QueryAuditLogRequest): Promise<AuditLogEntry[]> {
    let query = this.databaseClient
      .selectFrom("core.audit_log")
      .select(["actor", "operation", "entity", "data", "created_at"]);

    if (start_time) {
      query = query.where("created_at", ">=", new Date(start_time * 1000));
    }
    if (end_time) {
      query = query.where("created_at", "<=", new Date(end_time * 1000));
    }
    if (actor) {
      query = query.where("actor", "=", actor);
    }
    if (entity) {
      query = query.where("entity", "=", entity);
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
