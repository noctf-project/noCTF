import { AdminUpdateSubmissionsRequest } from "@noctf/api/requests";
import { ServiceCradle } from "../index.ts";
import { SubmissionDAO } from "../dao/submission.ts";
import { AuditParams } from "../types/audit_log.ts";
import { SubmissionUpdateEvent } from "@noctf/api/events";
import { SubmissionStatus } from "@noctf/api/enums";

type Props = Pick<
  ServiceCradle,
  "auditLogService" | "databaseClient" | "eventBusService"
>;
export class SubmissionService {
  private readonly dao;

  private readonly auditLogService;
  private readonly eventBusService;

  constructor({ databaseClient, auditLogService, eventBusService }: Props) {
    this.auditLogService = auditLogService;
    this.eventBusService = eventBusService;
    this.dao = new SubmissionDAO(databaseClient.get());
  }

  async listSummary(
    params?: {
      created_at?: [Date | null, Date | null];
      user_id?: number[];
      team_id?: number[];
      status?: SubmissionStatus[];
      hidden?: boolean;
      challenge_id?: number[];
      data?: string;
    },
    limit?: { limit?: number; offset?: number },
  ) {
    return this.dao.listSummary(params, limit);
  }

  async getCount(params?: {
    created_at?: [Date | null, Date | null];
    user_id?: number[];
    team_id?: number[];
    status?: SubmissionStatus[];
    hidden?: boolean;
    challenge_id?: number[];
    data?: string;
  }) {
    return this.dao.getCount(params);
  }

  async update(r: AdminUpdateSubmissionsRequest, audit?: AuditParams) {
    const { ids, ...rest } = r;
    const updates = await this.dao.bulkUpdate(ids, rest);
    if (updates.length > 0)
      await this.auditLogService.log({
        operation: "submission.update",
        entities: updates.map(({ id }) => `submission:${id}`),
        actor: audit?.actor,
        data: audit?.message,
      });
    updates.sort((a, b) => a.created_at.getTime() - b.created_at.getTime());
    const seqMap = new Map<number, number>();
    for (const {
      id,
      status,
      user_id,
      team_id,
      hidden,
      challenge_id,
      created_at,
      updated_at,
      seq,
    } of updates) {
      let vSeq = seqMap.get(id);
      if (!vSeq) {
        vSeq = 1;
        seqMap.set(id, vSeq);
      }
      await this.eventBusService.publish(SubmissionUpdateEvent, {
        id,
        user_id: user_id || undefined,
        team_id,
        challenge_id,
        status,
        created_at,
        updated_at,
        hidden,
        seq: status === "correct" ? seq + vSeq : 0,
        is_update: true,
      });
    }
    return updates.map(({ id }) => id);
  }
}
