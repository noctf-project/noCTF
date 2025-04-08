import type { Insertable, Updateable } from "kysely";
import type { DBType } from "../clients/database.ts";
import type { Team, TeamSummary } from "@noctf/api/datatypes";
import type { DB, TeamMemberRole } from "@noctf/schema";
import { FilterUndefined } from "../util/filter.ts";
import { BadRequestError, ConflictError, NotFoundError } from "../errors.ts";
import { sql } from "kysely";
import { partition } from "../util/object.ts";
import { PostgresErrorCode, PostgresErrorConfig } from "../util/pgerror.ts";
import { TryPGConstraintError } from "../util/pgerror.ts";

const CREATE_ERROR_CONFIG: PostgresErrorConfig = {
  [PostgresErrorCode.Duplicate]: {
    team_name_key: () => new ConflictError("The team name already exists"),
    default: (e) =>
      new ConflictError("A duplicate entry was detected", { cause: e }),
  },
  [PostgresErrorCode.ForeignKeyViolation]: {
    team_division_id_fkey: () =>
      new BadRequestError("Division ID does not exist"),
  },
};

export type MinimalTeamInfo = {
  id: number;
  division_id: number;
  flags: string[];
  tag_ids: number[];
};

export class TeamDAO {
  constructor(private readonly db: DBType) {}

  async create({
    name,
    bio,
    country,
    join_code,
    division_id,
    flags,
  }: Insertable<DB["team"]>): Promise<Team> {
    try {
      const { id, created_at } = await this.db
        .insertInto("team")
        .values({
          name,
          bio,
          country,
          join_code,
          division_id,
          flags,
        })
        .returning(["id", "created_at"])
        .executeTakeFirstOrThrow();

      return {
        id,
        name,
        bio: bio || "",
        country: country || null,
        join_code: join_code || null,
        division_id,
        flags: flags || [],
        created_at,
      };
    } catch (e) {
      const pgerror = TryPGConstraintError(e, CREATE_ERROR_CONFIG);
      if (pgerror) throw pgerror;
      throw e;
    }
  }

  async findUsingJoinCode(join_code: string) {
    const result = await this.db
      .selectFrom("team")
      .select(["id", "flags"])
      .where("join_code", "=", join_code)
      .executeTakeFirst();
    if (!result) {
      throw new NotFoundError("Team not found");
    }
    return result;
  }

  async get(id: number): Promise<Team> {
    const result = await this.db
      .selectFrom("team")
      .select([
        "id",
        "name",
        "bio",
        "country",
        "join_code",
        "division_id",
        "flags",
        "created_at",
      ])
      .where("id", "=", id)
      .executeTakeFirst();
    if (!result) {
      throw new NotFoundError("Team not found");
    }
    return result;
  }

  async listSummary(
    params?: Parameters<TeamDAO["listQuery"]>[0],
    limit?: { limit?: number; offset?: number },
  ): Promise<TeamSummary[]> {
    let query = this.listQuery(params)
      .select([
        "id",
        "name",
        "bio",
        "country",
        "division_id",
        "created_at",
        "flags",
        (eb) =>
          eb
            .selectFrom("team_member")
            .select(eb.fn.countAll().as("count"))
            .where("team_member.team_id", "=", eb.ref("team.id"))
            .as("num_members"),
      ])
      .orderBy("id");
    if (limit?.limit) {
      query = query.limit(limit.limit);
    }
    if (limit?.offset) {
      query = query.offset(limit.offset);
    }
    return query.execute() as Promise<TeamSummary[]>;
  }

  async getCount(
    params?: Parameters<TeamDAO["listQuery"]>[0],
  ): Promise<number> {
    return (
      await this.listQuery(params)
        .select(this.db.fn.countAll().as("count"))
        .executeTakeFirstOrThrow()
    ).count as number;
  }

  async queryNames(
    ids: number[],
    include_hidden?: boolean,
  ): Promise<{ id: number; name: string }[]> {
    let query = this.db
      .selectFrom("team")
      .select(["id", "name"])
      .where("id", "in", ids);
    if (!include_hidden) {
      query = query.where((eb) =>
        eb.not(eb("flags", "&&", eb.val(["hidden"]))),
      );
    }
    return query.execute();
  }

  async listForScoreboard(division?: number): Promise<MinimalTeamInfo[]> {
    let query = this.db
      .selectFrom("team as t")
      .distinctOn("t.id")
      .leftJoin("team_tag_member as ttm", "t.id", "ttm.team_id")
      .innerJoin(
        this.db // check that team has activity
          .selectFrom("submission")
          .select("team_id")
          .where("status", "=", "correct")
          .union(this.db.selectFrom("award").select("team_id"))
          .as("combined_teams"),
        "t.id",
        "combined_teams.team_id",
      )
      .select([
        "t.id",
        "t.division_id",
        "t.flags",
        sql<number[]>`COALESCE(
          array_agg(ttm.tag_id) FILTER (WHERE ttm.tag_id IS NOT NULL),
          ARRAY[]::integer[])`.as("tag_ids"),
      ])
      .groupBy("t.id");

    if (division) query = query.where("t.division_id", "=", division);
    return await query.execute();
  }

  async update(id: number, v: Updateable<DB["team"]>) {
    await this.db
      .updateTable("team")
      .set(FilterUndefined(v))
      .where("id", "=", id)
      .executeTakeFirstOrThrow();
  }

  async delete(id: number) {
    const { numDeletedRows } = await this.db
      .deleteFrom("team")
      .where("id", "=", id)
      .executeTakeFirst();
    if (!numDeletedRows) {
      throw new NotFoundError("Team does not exist");
    }
  }

  async assign({
    user_id,
    team_id,
    role,
  }: {
    user_id: number;
    team_id: number;
    role?: TeamMemberRole;
  }) {
    const { numInsertedOrUpdatedRows } = await this.db
      .insertInto("team_member")
      .values({
        user_id,
        team_id,
        role,
      })
      .onConflict((b) =>
        b
          .column("user_id")
          .doUpdateSet({ role })
          .where("team_member.team_id", "=", team_id)
          .where("team_member.role", "!=", role),
      )
      .executeTakeFirst();
    if (!numInsertedOrUpdatedRows) {
      throw new ConflictError("User has already joined a team.");
    }
  }

  async unassign({
    user_id,
    team_id,
    check_owner,
  }: {
    user_id: number;
    team_id: number;
    check_owner?: boolean;
  }) {
    let query = this.db
      .deleteFrom("team_member")
      .where("user_id", "=", user_id)
      .where("team_id", "=", team_id);
    if (check_owner) {
      query = query.where((op) =>
        op.or([
          op(
            op
              .selectFrom("team_member")
              .select((o) => o.fn.countAll().as("cnt"))
              .where("team_id", "=", team_id)
              .where("user_id", "!=", user_id)
              .where("role", "=", "owner"),
            "!=",
            0,
          ),
          op(
            op
              .selectFrom("team_member")
              .select((o) => o.fn.countAll().as("cnt"))
              .where("team_id", "=", team_id),
            "=",
            1,
          ),
        ]),
      );
    }
    const { numDeletedRows } = await query.executeTakeFirst();
    if (!numDeletedRows) {
      throw new NotFoundError("User's membership does not exist.");
    }
  }

  async getMembershipForUser(user_id: number) {
    const result = await this.db
      .selectFrom("team_member")
      .innerJoin("team", "team.id", "team_member.team_id")
      .select(["team_id", "role", "team.division_id"])
      .where("user_id", "=", user_id)
      .executeTakeFirst();

    if (!result) {
      return null;
    }
    return result;
  }

  async listMembers(id: number) {
    return this.db
      .selectFrom("team_member")
      .select(["user_id", "role"])
      .where("team_id", "=", id)
      .execute();
  }

  private listQuery(params?: {
    flags?: string[];
    ids?: number[];
    name_prefix?: string;
    division_id?: number;
  }) {
    let query = this.db.selectFrom("team");
    if (params?.flags) {
      const [no, yes] = partition(params.flags, (f) => f.startsWith("!"));

      if (yes.length) {
        query = query.where("flags", "&&", sql.val(yes));
      }
      if (no.length) {
        query = query.where((eb) =>
          eb.not(eb("flags", "&&", eb.val(no.map((f) => f.substring(1))))),
        );
      }
    }
    if (params?.name_prefix) {
      query = query.where("name", "^@", params.name_prefix.toLowerCase());
    }
    if (params?.division_id) {
      query = query.where("division_id", "=", params.division_id);
    }
    if (params?.ids && params?.ids.length) {
      query = query.where("id", "in", params.ids);
    }
    return query;
  }
}
