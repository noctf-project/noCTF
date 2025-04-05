import type { DB } from "@noctf/schema";
import type { Insertable } from "kysely";
import { DBType } from "../clients/database.ts";
import { AdminQuerySubmissionsRequest } from "@noctf/api/requests";
import { LimitOffset, Submission } from "@noctf/api/datatypes";
import { SubmissionStatus } from "@noctf/api/enums";
import { PostgresErrorCode, TryPGConstraintError } from "../util/pgerror.ts";
import { ConflictError } from "../errors.ts";

export class SubmissionDAO {
  constructor(private readonly db: DBType) {}

  async create(v: Insertable<DB["submission"]>) {
    await this.db.insertInto("submission").values(v).executeTakeFirst();
  }

  async getCurrentMetadata(challenge_id: number, team_id: number) {
    return await this.db
      .selectFrom("submission")
      .select(["id", "user_id", "status", "created_at"])
      .where("challenge_id", "=", challenge_id)
      .where("team_id", "=", team_id)
      .where("status", "in", ["correct", "queued"])
      .executeTakeFirst();
  }

  async bulkUpdate(
    ids: number[],
    params: {
      comments?: string;
      hidden?: boolean;
      status?: SubmissionStatus;
    },
  ) {
    let query = this.db
      .updateTable("submission")
      .where("id", "in", ids)
      .set("updated_at", new Date())
      .returning("id");
    if (typeof params.comments === "string") {
      query = query.set("comments", params.comments);
    }
    if (typeof params.hidden === "boolean") {
      query = query.set("hidden", params.hidden);
    }
    if (params.status) {
      query = query.set("status", params.status);
    }
    try {
      return (await query.execute()).map(({ id }) => id);
    } catch (e) {
      const pgerror = TryPGConstraintError(e, {
        [PostgresErrorCode.Duplicate]: {
          submission_uidx_queued_correct: () =>
            new ConflictError(
              "More than 1 submission owned by the same team and challenge was set to queued or correct",
            ),
          default: (e) =>
            new ConflictError("Invalid parameters passed to challenge update", {
              cause: e,
            }),
        },
      });
      if (pgerror) throw pgerror;
      throw e;
    }
  }

  async query(
    {
      created_at,
      user_id,
      team_id,
      status,
      hidden,
      challenge_id,
      data,
    }: Omit<AdminQuerySubmissionsRequest, "limit|offset">,
    limit?: LimitOffset,
  ): Promise<Submission[]> {
    let query = this.db
      .selectFrom("submission")
      .select([
        "id",
        "user_id",
        "team_id",
        "challenge_id",
        "data",
        "comments",
        "source",
        "hidden",
        "status",
        "created_at",
        "updated_at",
      ]);

    if (created_at) {
      if (created_at[0]) query = query.where("created_at", ">=", created_at[0]);
      if (created_at[1]) query = query.where("created_at", "<=", created_at[1]);
    }

    if (user_id && user_id.length) {
      query = query.where("user_id", "in", user_id);
    }

    if (team_id && team_id.length) {
      query = query.where("team_id", "in", team_id);
    }

    if (status && status.length) {
      query = query.where("status", "in", status);
    }

    if (typeof hidden === "boolean") {
      query = query.where("hidden", "=", hidden);
    }

    if (challenge_id && challenge_id.length) {
      query = query.where("challenge_id", "in", challenge_id);
    }

    if (data) {
      query = query.where("data", "like", data);
    }

    if (limit?.limit) {
      query = query.limit(limit.limit);
    }

    return query
      .orderBy("created_at desc")
      .offset(limit?.offset || 0)
      .execute();
  }
}
