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
> & { weight: number };

export type ReturnedSubmissionUpdate = Pick<
  Submission,
  | "id"
  | "hidden"
  | "status"
  | "user_id"
  | "team_id"
  | "challenge_id"
  | "created_at"
  | "updated_at"
> & { seq: number };

const GetSeq = (eb: ExpressionBuilder<DB, "submission">) =>
  eb
    .case()
    .when("submission.status", "=", "correct")
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

  async create(values: Insertable<DB["submission"]>[], skipIfExists?: boolean) {
    let query = this.db.insertInto("submission").values(values);
    if (skipIfExists) {
      query = query.onConflict((oc) =>
        oc
          .columns(["challenge_id", "team_id"])
          .where(sql`status`, "in", sql`('queued', 'correct')`)
          .doNothing(),
      );
    }
    return await query.returning(["id", "created_at", "updated_at"]).execute();
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

  async updateSubmissions(
    values: {
      id: number;
      hidden?: boolean;
      status?: SubmissionStatus;
      value?: number | null;
    }[],
  ): Promise<ReturnedSubmissionUpdate[]> {
    const vs = sql.join(
      values.map(
        (v) => sql`(
        ${sql.val(v.id)}::integer,
        ${sql.val(v.hidden)}::boolean,
        ${sql.val(v.status)}::submission_status,
        ${sql.val(v.value)}::integer,
        ${sql.val(!!v.value || v.value === 0 || v.value === null)}::boolean
        )`,
      ),
    );
    const query = this.db
      .updateTable("submission")
      .from(
        sql`(VALUES ${vs})`.as<"v">(
          sql`v(id, hidden, status, value, update_value)`,
        ),
      )
      .set((eb) => ({
        hidden: sql`COALESCE(v.hidden, ${eb.ref("submission.hidden")})`,
        status: sql`COALESCE(v.status, ${eb.ref("submission.status")})`,
        value: sql`CASE
          WHEN v.update_value = TRUE THEN v.value
          ELSE ${eb.ref("submission.value")}
        END`,
      }))
      .whereRef("submission.id", "=", sql`v.id`)
      .returning((eb) => [
        "submission.id as id",
        "submission.hidden as hidden",
        "submission.status as status",
        "user_id",
        "team_id",
        "challenge_id",
        "created_at",
        "updated_at",
        GetSeq(eb).as("seq"),
      ]);
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
        "source",
        "hidden",
        "value",
        "status",
        "created_at",
        "updated_at",
      ])
      .orderBy("created_at", "desc");

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
    // TODO: fix this abomination of a query
    let query = this.db
      .selectFrom("submission as s")
      .innerJoin("team", "s.team_id", "team.id")
      .leftJoinLateral(
        (eb) =>
          eb
            .selectFrom("submission_weight as w")
            .select(["w.weight", "w.created_at as weight_created_at"])
            .whereRef("w.challenge_id", "=", "s.challenge_id")
            .whereRef("w.team_id", "=", "s.team_id")
            .orderBy("w.created_at", "desc")
            .limit(1)
            .as("latest_w"),
        (join) => join.onTrue(),
      )
      .select([
        "s.id as id",
        "s.team_id as team_id",
        "s.user_id as user_id",
        "s.challenge_id as challenge_id",
        "s.hidden as hidden",
        "s.created_at as created_at",
        (eb) =>
          eb.fn
            .coalesce("latest_w.weight_created_at", "s.updated_at")
            .as("updated_at"),
        (eb) => eb.fn.coalesce("latest_w.weight", sql<number>`0`).as("weight"),
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

  async listStats({
    division_id,
    challenge_ids,
    start,
    end,
  }: {
    division_id: number;
    challenge_ids: number[];
    start?: Date;
    end?: Date;
  }) {
    let visibleSubmissions = this.db
      .selectFrom("submission as s")
      .innerJoin("team as t", "s.team_id", "t.id")
      .select([
        "s.challenge_id",
        "s.team_id",
        "s.status",
        "s.created_at",
        sql<number>`ROW_NUMBER() OVER (
          PARTITION BY s.challenge_id
          ORDER BY CASE WHEN s.status = 'correct' THEN s.created_at END ASC
        )`.as("rn_first"),
      ])
      .where("s.hidden", "=", false)
      .where("t.division_id", "=", division_id)
      .where(sql<boolean>`NOT ('hidden' = ANY(t.flags))`)
      .where("s.challenge_id", "in", challenge_ids);
    if (start) {
      visibleSubmissions = visibleSubmissions.where(
        "s.created_at",
        ">=",
        start,
      );
    }
    if (end) {
      visibleSubmissions = visibleSubmissions.where("s.created_at", "<=", end);
    }

    const results = await this.db
      .selectFrom(visibleSubmissions.as("ordered"))
      .select([
        "challenge_id",
        sql<number>`COUNT(*) FILTER (WHERE status = 'correct')`.as(
          "correct_count",
        ),
        sql<number>`COUNT(*) FILTER (WHERE status = 'incorrect')`.as(
          "incorrect_count",
        ),
        sql<Date>`MIN(created_at) FILTER (WHERE status = 'correct')`.as(
          "first_solve",
        ),
        sql<number>`MAX(team_id) FILTER (WHERE status = 'correct' AND rn_first = 1)`.as(
          "first_solve_team_id",
        ),
      ])
      .groupBy("challenge_id")
      .orderBy("challenge_id")
      .execute();
    return results.map((x) => ({
      ...x,
      id: x.challenge_id,
      correct_count: Number(x.correct_count),
      incorrect_count: Number(x.incorrect_count),
    }));
  }
}
