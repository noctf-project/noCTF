import type { DB } from "@noctf/schema";
import { sql, type Insertable } from "kysely";
import { DBType } from "../clients/database.ts";
import { LimitOffset, Submission } from "@noctf/api/datatypes";
import { SubmissionStatus } from "@noctf/api/enums";
import { PostgresErrorCode, TryPGConstraintError } from "../util/pgerror.ts";
import { ConflictError } from "../errors.ts";
import { ExpressionBuilder } from "kysely";

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

const GetSeq = (eb: ExpressionBuilder<DB, "submission">) =>
  eb
    .case()
    .when("status", "=", "correct")
    .then(
      eb
        .selectFrom("submission as s")
        .innerJoin("team as t", "t.id", "s.team_id")
        .select(eb.fn.countAll().as("count"))
        .where("challenge_id", "=", eb.ref("submission.challenge_id"))
        .where("status", "=", "correct")
        .where("s.hidden", "is", false)
        .where((eb) => eb.not(eb("t.flags", "&&", sql.val(["hidden"]))))
        .where(
          "t.division_id",
          "=",
          eb
            .selectFrom("team")
            .select("division_id")
            .where("id", "=", eb.ref("submission.team_id")),
        ),
    )
    .else(0)
    .end();

export class SubmissionDAO {
  constructor(private readonly db: DBType) {}

  async create(v: Insertable<DB["submission"]>) {
    const data = await this.db
      .insertInto("submission")
      .values(v)
      .returning((eb) => [
        "id",
        "created_at",
        "updated_at",
        GetSeq(eb).as("seq"),
      ])
      .executeTakeFirstOrThrow();
    return { ...data, seq: Number(data.seq) };
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
        "created_at",
        "updated_at",
        "status",
        GetSeq(eb).as("seq"),
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
      return (await query.execute()).map((x) => ({ ...x, seq: Number(x.seq) }));
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

  private listQuery(
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
    let query = this.db.selectFrom("submission");

    if (params?.created_at) {
      if (params.created_at[0])
        query = query.where("created_at", ">=", params.created_at[0]);
      if (params.created_at[1])
        query = query.where("created_at", "<=", params.created_at[1]);
    }

    if (params?.user_id && params.user_id.length) {
      query = query.where("user_id", "in", params.user_id);
    }

    if (params?.team_id && params.team_id.length) {
      query = query.where("team_id", "in", params.team_id);
    }

    if (params?.status && params.status.length) {
      query = query.where("status", "in", params.status);
    }

    if (typeof params?.hidden === "boolean") {
      query = query.where("hidden", "=", params.hidden);
    }

    if (params?.challenge_id && params.challenge_id.length) {
      query = query.where("challenge_id", "in", params.challenge_id);
    }

    if (params?.data) {
      const escaped = params.data.replace(/[_%]/g, "\\$&");
      query = query.where("data", "like", `%${escaped}%`);
    }

    if (limit?.limit) {
      query = query.limit(limit.limit);
    }
    if (limit?.offset) {
      query = query.offset(limit.offset);
    }

    return query;
  }

  async listSummary(
    filters: Parameters<SubmissionDAO["listQuery"]>[0],
    limit?: LimitOffset,
  ): Promise<Submission[]> {
    const query = this.listQuery(filters, limit)
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
      ])
      .orderBy("created_at desc");

    return query.execute();
  }

  async getCount(
    params?: Parameters<SubmissionDAO["listQuery"]>[0],
  ): Promise<number> {
    return (
      await this.listQuery(params)
        .select(this.db.fn.countAll().as("count"))
        .executeTakeFirstOrThrow()
    ).count as number;
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
