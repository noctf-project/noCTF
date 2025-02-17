import type { Insertable, Updateable } from "kysely";
import type { DBType } from "../clients/database.ts";
import type { Team } from "@noctf/api/datatypes";
import type { DB, TeamMemberRole } from "@noctf/schema";
import { FilterUndefined } from "../util/filter.ts";
import { ConflictError, NotFoundError } from "../errors.ts";
import { sql } from "kysely";
import { partition } from "../util/object.ts";

export class TeamDAO {
  async create(
    db: DBType,
    { name, bio, join_code, division_id, flags }: Insertable<DB["team"]>,
  ): Promise<Team> {
    const { id, created_at } = await db
      .insertInto("team")
      .values({
        name,
        bio,
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
      join_code: join_code || null,
      division_id,
      flags: flags || [],
      created_at,
    };
  }

  async findUsingJoinCode(db: DBType, join_code: string) {
    const result = await db
      .selectFrom("team")
      .select(["id", "flags"])
      .where("join_code", "=", join_code)
      .executeTakeFirst();
    if (!result) {
      throw new NotFoundError("Team not found");
    }
    return result;
  }

  async get(db: DBType, id: number): Promise<Team> {
    const result = await db
      .selectFrom("team")
      .select([
        "id",
        "name",
        "bio",
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

  async list(db: DBType, flags?: string[]): Promise<Team[]> {
    let query = db
      .selectFrom("team")
      .select([
        "id",
        "name",
        "bio",
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

  async update(db: DBType, id: number, v: Updateable<DB["team"]>) {
    await db
      .updateTable("team")
      .set(FilterUndefined(v))
      .where("id", "=", id)
      .executeTakeFirstOrThrow();
  }

  async delete(db: DBType, id: number) {
    const { numDeletedRows } = await db
      .deleteFrom("team")
      .where("id", "=", id)
      .executeTakeFirst();
    if (!numDeletedRows) {
      throw new NotFoundError("Team does not exist");
    }
  }

  async assign(
    db: DBType,
    {
      user_id,
      team_id,
      role,
    }: { user_id: number; team_id: number; role?: TeamMemberRole },
  ) {
    const { numInsertedOrUpdatedRows } = await db
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

  async unassign(
    db: DBType,
    {
      user_id,
      team_id,
      check_owner,
    }: {
      user_id: number;
      team_id: number;
      check_owner?: boolean;
    },
  ) {
    let query = db
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

  async getMembershipForUser(db: DBType, user_id: number) {
    const result = await db
      .selectFrom("team_member")
      .select(["team_id", "role"])
      .where("user_id", "=", user_id)
      .executeTakeFirst();

    if (!result) {
      return null;
    }
    return result;
  }

  async listMembers(db: DBType, id: number) {
    return db
      .selectFrom("team_member")
      .select(["user_id", "role"])
      .where("team_id", "=", id)
      .execute();
  }
}
