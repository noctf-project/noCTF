import type { AuditLogEntry } from "@noctf/api/datatypes";
import type { QueryAuditLogRequest } from "@noctf/api/requests";
import type { ServiceCradle } from "../index.ts";
import type { AuditLogActor } from "../types/audit_log.ts";
import { sql } from "kysely";
import { ActorType } from "../types/enums.ts";

const MAX_QUERY_LIMIT = 100;
type Props = Pick<ServiceCradle, "databaseClient">;

export const SYSTEM_ACTOR: AuditLogActor = {
  type: ActorType.SYSTEM,
};

export class AuditLogService {
  private readonly databaseClient: Props["databaseClient"];

  constructor({ databaseClient }: Props) {
    this.databaseClient = databaseClient;
  }

  async log({
    operation,
    actor: { type, id } = SYSTEM_ACTOR,
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

    return await query
      .orderBy("created_at desc")
      .offset(offset || 0)
      .limit(limit > MAX_QUERY_LIMIT ? MAX_QUERY_LIMIT : limit)
      .execute();
  }
}
