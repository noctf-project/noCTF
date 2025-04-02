import type { Insertable, Updateable } from "kysely";
import type { DBType } from "../clients/database.ts";
import type { Team } from "@noctf/api/datatypes";
import type { DB, TeamMemberRole } from "@noctf/schema";
import { FilterUndefined } from "../util/filter.ts";
import { ConflictError, NotFoundError } from "../errors.ts";
import { sql } from "kysely";
import { partition } from "../util/object.ts";

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

  async list(flags?: string[]): Promise<Team[]> {
    let query = this.db
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
      ]);
    if (flags) {
      const [no, yes] = partition(flags, (f) => f.startsWith("!"));

      if (yes.length) {
        query = query.where("flags", "&&", sql.val(yes));
      }
      if (no.length) {
        query = query.where((eb) =>
          eb.not(eb("flags", "&&", eb.val(no.map((f) => f.substring(1))))),
        );
      }
    }
    return query.execute();
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
}
