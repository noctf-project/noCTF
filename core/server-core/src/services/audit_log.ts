import type { AuditLogEntry } from "@noctf/api/datatypes";
import type { QueryAuditLogRequest } from "@noctf/api/requests";
import type { ServiceCradle } from "../index.ts";
import type { AuditLogActor } from "../types/audit_log.ts";
import { ActorType } from "../types/enums.ts";
import { AuditLogDAO } from "../dao/audit_log.ts";
import { LimitCursorEncoded, PaginationCursor } from "../types/pagination.ts";

type Props = Pick<ServiceCradle, "databaseClient">;

export const SYSTEM_ACTOR: AuditLogActor = {
  type: ActorType.SYSTEM,
};

export class AuditLogService {
  private readonly dao;
  private readonly databaseClient;

  constructor({ databaseClient }: Props) {
    this.databaseClient = databaseClient;
    this.dao = new AuditLogDAO(databaseClient.get());
  }

  async log(v: {
    operation: string;
    actor?: AuditLogActor;
    entities?: string[];
    data?: string;
  }) {
    const { type, id } = v.actor || SYSTEM_ACTOR;
    return this.dao.create({
      operation: v.operation,
      data: v.data || null,
      entities: v.entities || [],
      actor: id ? `${type}:${id}` : type,
    });
  }

  async query(
    q: Omit<QueryAuditLogRequest, "page" | "page_size">,
    limit?: number,
  ): Promise<AuditLogEntry[]> {
    return this.dao.query(q, limit);
  }

  async getCount(q: Omit<QueryAuditLogRequest, "page" | "page_size">) {
    return this.dao.getCount(q);
  }
}
