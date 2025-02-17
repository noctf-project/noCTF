import type { AuditLogEntry } from "@noctf/api/datatypes";
import type { QueryAuditLogRequest } from "@noctf/api/requests";
import type { ServiceCradle } from "../index.ts";
import type { AuditLogActor } from "../types/audit_log.ts";
import { ActorType } from "../types/enums.ts";
import { AuditLogDAO } from "../dao/audit_log.ts";

type Props = Pick<ServiceCradle, "databaseClient">;

export const SYSTEM_ACTOR: AuditLogActor = {
  type: ActorType.SYSTEM,
};

export class AuditLogService {
  private readonly dao;

  constructor({ databaseClient }: Props) {
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

  async query(q: QueryAuditLogRequest): Promise<AuditLogEntry[]> {
    return this.dao.query(q);
  }
}
