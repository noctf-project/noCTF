import { AdminUpdateSubmissionsRequest } from "@noctf/api/requests";
import { ServiceCradle } from "../index.ts";
import {
  RawSolve,
  ReturnedSubmissionUpdate,
  SubmissionDAO,
} from "../dao/submission.ts";
import { SubmissionWeightDAO } from "../dao/submission_weight.ts";
import { SubmissionUpdateEvent } from "@noctf/api/events";
import { SubmissionStatus } from "@noctf/api/enums";
import { BadRequestError } from "../errors.ts";
import { FilterUndefined } from "../util/filter.ts";
import { AuditLogActor } from "../types/audit_log.ts";

type Props = Pick<
  ServiceCradle,
  "databaseClient" | "eventBusService" | "auditLogService"
>;
export class SubmissionService {
  private readonly dao;

  private readonly databaseClient;
  private readonly eventBusService;
  private readonly auditLogService;

  constructor({ databaseClient, eventBusService, auditLogService }: Props) {
    this.databaseClient = databaseClient;
    this.eventBusService = eventBusService;
    this.auditLogService = auditLogService;
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
    updates.sort((a, b) => a.created_at.getTime() - b.created_at.getTime());
    await this.sendUpdateEvents(updates);
    return updates;
  }

  async listWeights(
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
    return await this.dao.listWeights(params, limit);
  }

  async upsertWeightsForChallenge(
    challenge_id: number,
    items: Pick<RawSolve, "team_id" | "weight">[],
  ) {
    const map = new Map<number, (typeof items)[number]>();
    const values = items.map((v) => {
      map.set(v.team_id, v);
      return {
        team_id: v.team_id,
        weight: v.weight,
        challenge_id,
      };
    });
    if (map.size !== items.length) {
      throw new BadRequestError("Duplicate items detected in update");
    }

    const updates = await this.databaseClient.transaction(async (tx) => {
      const submissionDAO = new SubmissionDAO(tx);
      const updates = await submissionDAO.upsertWeights(values);
      if (updates.length > 0) {
        const weightDAO = new SubmissionWeightDAO(tx);
        await weightDAO.create(
          updates.map((u) => ({
            challenge_id: u.challenge_id,
            team_id: u.team_id,
            weight: map.get(u.team_id)?.weight ?? 0,
          })),
        );
      }
      return updates;
    });
    updates.sort((a, b) => a.created_at.getTime() - b.created_at.getTime());
    await this.sendUpdateEvents(updates);
    return updates;
  }

  private async sendUpdateEvents(updates: ReturnedSubmissionUpdate[]) {
    // The DB returns the same seq if we update multiple records for the
    // same challenge to correct at the same time.
    const seqMap = new Map<number, number>();
    const messages = new Array(updates.length);
    let i = 0;
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
      const vSeq = (seqMap.get(challenge_id) || 0) + 1;
      seqMap.set(challenge_id, vSeq);
      messages[i++] = {
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
      };
    }
    await this.eventBusService.publishBatch(SubmissionUpdateEvent, messages);
  }
}
