import { Submission } from "@noctf/api/datatypes";
import {
  AdminQuerySubmissionsRequest,
  AdminUpdateSubmissionsRequest,
} from "@noctf/api/requests";
import { ServiceCradle } from "../index.ts";
import { SubmissionDAO } from "../dao/submission.ts";
import { AuditParams } from "../types/audit_log.ts";

type Props = Pick<ServiceCradle, "auditLogService" | "databaseClient">;
export class SubmissionService {
  private readonly dao;

  private readonly auditLogService;

  constructor({ databaseClient, auditLogService }: Props) {
    this.auditLogService = auditLogService;
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
        entities: updates.map((id) => `submission:${id}`),
        actor: audit?.actor,
        data: audit?.message,
      });
    return updates;
  }
}
