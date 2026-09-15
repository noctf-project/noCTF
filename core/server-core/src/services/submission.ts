import { AdminUpdateSubmissionsRequest } from "@noctf/api/requests";
import { ServiceCradle } from "../index.ts";
import { SubmissionDAO } from "../dao/submission.ts";
import { SubmissionWeightDAO } from "../dao/submission_weight.ts";
import { ScoreboardTriggerEvent } from "@noctf/api/events";
import { SubmissionStatus } from "@noctf/api/enums";
import { BadRequestError } from "../errors.ts";
import { FilterUndefined } from "../util/filter.ts";
import { AuditLogActor } from "../types/audit_log.ts";

type Props = Pick<
  ServiceCradle,
  "databaseClient" | "eventBusService" | "auditLogService"
>;
export class SubmissionService {
  private readonly submissionDAO;
  private readonly weightDAO;

  private readonly databaseClient;
  private readonly eventBusService;
  private readonly auditLogService;

  constructor({ databaseClient, eventBusService, auditLogService }: Props) {
    this.databaseClient = databaseClient;
    this.eventBusService = eventBusService;
    this.auditLogService = auditLogService;
    this.submissionDAO = new SubmissionDAO(databaseClient.get());
    this.weightDAO = new SubmissionWeightDAO(databaseClient.get());
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
    return this.submissionDAO.listSummary(params, limit);
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
    return this.submissionDAO.getCount(params);
  }

  async update(
    submissions: AdminUpdateSubmissionsRequest["submissions"],
    actor?: AuditLogActor,
  ) {
    const map = submissions.reduce((prev, cur) => {
      prev.set(cur.id, cur);
      return prev;
    }, new Map<number, AdminUpdateSubmissionsRequest["submissions"][0]>());
    if (map.size !== submissions.length) {
      throw new BadRequestError("Duplicate items detected in update");
    }

    const updates = await this.databaseClient.transaction(async (tx) => {
      const submissionDAO = new SubmissionDAO(tx);
      const updates = await submissionDAO.updateSubmissions(submissions);
      if (updates.length !== submissions.length) {
        const updatedIds = new Set(updates.map((u) => u.id));
        const missingIds = submissions
          .map((s) => s.id)
          .filter((id) => !updatedIds.has(id));
        throw new BadRequestError(
          `Not all submissions found, missing: ${missingIds.join(", ")}`,
        );
      }
      return updates;
    });
    if (updates.length > 0) {
      const audit = {
        changes: {} as Record<string, string | number | boolean | null>,
        comment: "",
      };
      for (const { id: _id, comment, ...fields } of submissions) {
        if (comment !== undefined) audit.comment = comment;
        Object.assign(audit.changes, FilterUndefined(fields));
      }
      await this.auditLogService.log({
        operation: "submission.update",
        entities: updates.map(({ id }) => `submission:${id}`),
        actor,
        data: JSON.stringify(audit),
      });
    }
    await this.eventBusService.publish(ScoreboardTriggerEvent, {});
    updates.sort((a, b) => a.created_at.getTime() - b.created_at.getTime());
    return updates;
  }

  async listWeights(challenge_id: number, team_id?: number[]) {
    return await this.weightDAO.listLatest(challenge_id, team_id);
  }

  async upsertWeightsForChallenge(
    challenge_id: number,
    items: { team_id: number; weight: number }[],
  ) {
    const map = new Map<number, (typeof items)[number]>();
    const values = items.map((v) => {
      map.set(v.team_id, v);
      return {
        team_id: v.team_id,
        challenge_id,
        source: "weight",
        status: "correct" as SubmissionStatus,
      };
    });
    if (map.size !== items.length) {
      throw new BadRequestError("Duplicate items detected in update");
    }

    await this.databaseClient.transaction(async (tx) => {
      const submissionDAO = new SubmissionDAO(tx);
      const weightDAO = new SubmissionWeightDAO(tx);
      await submissionDAO.create(values, true);
      await weightDAO.create(
        items.map(({ team_id, weight }) => ({ challenge_id, team_id, weight })),
      );
    });
    await this.eventBusService.publish(ScoreboardTriggerEvent, {});
  }
}
