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

  async query(q: AdminQuerySubmissionsRequest): Promise<Submission[]> {
    return this.dao.query(q, { limit: q.limit, offset: q.offset });
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
