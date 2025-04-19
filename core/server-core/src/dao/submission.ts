import type { DB } from "@noctf/schema";
import { sql, type Insertable } from "kysely";
import { DBType } from "../clients/database.ts";
import { AdminQuerySubmissionsRequest } from "@noctf/api/requests";
import { LimitOffset, Submission } from "@noctf/api/datatypes";
import { SubmissionStatus } from "@noctf/api/enums";
import { PostgresErrorCode, TryPGConstraintError } from "../util/pgerror.ts";
import { ConflictError } from "../errors.ts";

export type RawSolve = Pick<
  Submission,
  | "id"
  | "user_id"
  | "team_id"
  | "challenge_id"
  | "hidden"
  | "created_at"
  | "updated_at"
  | "value"
>;

export class SubmissionDAO {
  constructor(private readonly db: DBType) {}

  async create(v: Insertable<DB["submission"]>) {
    return await this.db
      .insertInto("submission")
      .values(v)
      .returning((eb) => ["id", "updated_at"])
      .executeTakeFirstOrThrow();
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
      value?: number | null;
      status?: SubmissionStatus;
    },
  ) {
    let query = this.db
      .updateTable("submission")
      .where("id", "in", ids)
      .set("updated_at", sql`CURRENT_TIMESTAMP`)
      .returning((eb) => [
        "id",
        "user_id",
        "team_id",
        "challenge_id",
        "hidden",
        "updated_at",
        "status",
      ]);
    if (typeof params.comments === "string") {
      query = query.set("comments", params.comments);
    }
    if (typeof params.hidden === "boolean") {
      query = query.set("hidden", params.hidden);
    }
    if (typeof params.value === "number" || params.value === null) {
      query = query.set("value", params.value);
    }
    if (params.status) {
      query = query.set("status", params.status);
    }
    try {
      return query.execute();
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
        "value",
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

  async getSolvesForCalculation(
    division_id?: number,
    params?: {
      sort?: "asc" | "desc";
      limit?: number;
      offset?: number;
    },
  ): Promise<RawSolve[]> {
    let query = this.db
      .selectFrom("submission as s")
      .innerJoin("team", "s.team_id", "team.id")
      .select([
        "s.id as id",
        "s.team_id as team_id",
        "s.user_id as user_id",
        "s.challenge_id as challenge_id",
        "s.hidden as hidden",
        "s.created_at as created_at",
        "s.updated_at as updated_at",
        "s.value as value",
      ])
      .where("s.status", "=", "correct")
      .orderBy("s.created_at", params?.sort || "asc");
    if (division_id) {
      query = query.where("team.division_id", "=", division_id);
    }
    if (params?.limit) {
      query = query.limit(params.limit);
    }
    if (params?.offset) {
      query = query.offset(params.offset);
    }
    return query.execute();
  }
}
