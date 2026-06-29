import { AdminUpdateSubmissionsRequest } from "@noctf/api/requests";
import { ServiceCradle } from "../index.ts";
import { SubmissionDAO } from "../dao/submission.ts";
import { AuditParams } from "../types/audit_log.ts";
import { SubmissionUpdateEvent } from "@noctf/api/events";
import { SubmissionStatus } from "@noctf/api/enums";
import { SubmissionLogDAO } from "../dao/submission_log.ts";
import { FilterUndefined } from "../util/filter.ts";
import { BadRequestError } from "../errors.ts";

type Props = Pick<ServiceCradle, "databaseClient" | "eventBusService">;
export class SubmissionService {
  private readonly dao;

  private readonly databaseClient;
  private readonly eventBusService;

  constructor({ databaseClient, eventBusService }: Props) {
    this.databaseClient = databaseClient;
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

  async update(r: AdminUpdateSubmissionsRequest, actor: string) {
    const { submissions } = r;
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
      if (updates.length > 0) {
        const logDAO = new SubmissionLogDAO(tx);
        await logDAO.create(
          updates.map((u) => {
            const {
              id: _id,
              comments,
              ...c
            } = map.get(u.id) ||
            ({} as AdminUpdateSubmissionsRequest["submissions"][0]);
            return {
              comments: comments,
              submission_id: u.id,
              actor,
              changes: FilterUndefined(c),
            };
          }),
        );
      }
      return updates;
    });

    // The DB returns the same seq if we update multiple records for the
    // same challenge to correct at the same time.
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
      const vSeq = (seqMap.get(challenge_id) || 0) + 1;
      seqMap.set(challenge_id, vSeq);
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
        comments: map.get(id)?.comments || "",
      });
    }
    return updates.map(({ id }) => id);
  }
}
