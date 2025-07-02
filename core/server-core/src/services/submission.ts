import { Submission } from "@noctf/api/datatypes";
import {
  AdminQuerySubmissionsRequest,
  AdminUpdateSubmissionsRequest,
} from "@noctf/api/requests";
import { ServiceCradle } from "../index.ts";
import { SubmissionDAO } from "../dao/submission.ts";
import { AuditParams } from "../types/audit_log.ts";
import { SubmissionUpdateEvent } from "@noctf/api/events";

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

  async query(
    q: AdminQuerySubmissionsRequest,
    pagination: { limit: number; offset: number },
  ): Promise<{
    entries: Submission[];
    total: number;
  }> {
    const query = {
      created_at: q.created_at,
      user_id: q.user_id,
      team_id: q.team_id,
      status: q.status,
      hidden: q.hidden,
      challenge_id: q.challenge_id,
      data: q.data,
    };

    const [entries, total] = await Promise.all([
      this.dao.query(query, pagination),
      this.dao.getCount(query),
    ]);

    return { entries, total };
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
    for (const {
      id,
      status,
      user_id,
      team_id,
      hidden,
      challenge_id,
      updated_at,
    } of updates) {
      await this.eventBusService.publish(SubmissionUpdateEvent, {
        id,
        user_id: user_id || undefined,
        team_id,
        challenge_id,
        status,
        updated_at,
        hidden,
      });
    }
    return updates.map(({ id }) => id);
  }
}
