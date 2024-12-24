import { ConflictError, NotFoundError } from "../errors.ts";
import { TeamFlag } from "../types/enums.ts";
import type { CoreTeamMemberRole, DB } from "@noctf/schema";
import type { ServiceCradle } from "../index.ts";
import { nanoid } from "nanoid";
import type { AuditParams } from "../types/audit_log.ts";
import { ActorType } from "../types/enums.ts";
import type { UpdateObject } from "kysely";
import { TeamConfig } from "@noctf/api/config";

type Props = Pick<
  ServiceCradle,
  "configService" | "databaseClient" | "cacheService" | "auditLogService"
>;

export class TeamService {
  private readonly databaseClient;
  private readonly auditLogService;
  private readonly configService;

  constructor({ configService, databaseClient, auditLogService }: Props) {
    this.databaseClient = databaseClient;
    this.auditLogService = auditLogService;
    this.configService = configService;
    void this.init();
  }

  async init() {
    await this.configService.register(TeamConfig, { max_members: 0 });
  }

  async create(
    {
      name,
      flags,
      generate_join_code,
    }: {
      name: string;
      flags?: string[];
      generate_join_code?: boolean;
      audit?: AuditParams;
    },
    { actor, message }: AuditParams = {},
  ) {
    const join_code = generate_join_code ? nanoid() : null;
    const { id, bio, created_at } = await this.databaseClient
      .get()
      .insertInto("core.team")
      .values({
        name,
        join_code,
        flags: flags || [],
      })
      .returning(["id", "bio", "created_at"])
      .executeTakeFirstOrThrow();
    await this.auditLogService.log({
      operation: "team.create",
      actor,
      data: message,
      entities: [`${ActorType.TEAM}:${id}`],
    });
    return {
      id,
      name,
      bio,
      join_code,
      flags: flags || [],
      created_at,
    };
  }

  async update(
    id: number,
    {
      name,
      bio,
      join_code,
      flags,
    }: {
      name?: string;
      bio?: string;
      flags?: string[];
      join_code?: "refresh" | "remove";
    },
    { actor, message }: AuditParams = {},
  ) {
    const set: UpdateObject<DB, "core.team", "core.team"> = {
      name,
      flags,
      bio,
    };
    if (join_code === "refresh") {
      set.join_code = nanoid();
    } else if (join_code === "remove") {
      set.join_code = null;
    }

    await this.databaseClient
      .get()
      .updateTable("core.team")
      .set(set)
      .where("id", "=", id)
      .executeTakeFirstOrThrow();

    await this.auditLogService.log({
      operation: "team.update",
      actor,
      data: message,
      entities: [`${ActorType.TEAM}:${id}`],
    });
  }

  async get(id: number) {
    return await this.databaseClient
      .get()
      .selectFrom("core.team")
      .select(["id", "name", "bio", "join_code", "flags", "created_at"])
      .where("id", "=", id)
      .executeTakeFirst();
  }

  async delete(id: number, { actor, message }: AuditParams = {}) {
    const { numDeletedRows } = await this.databaseClient
      .get()
      .deleteFrom("core.team")
      .where("id", "=", id)
      .executeTakeFirst();
    if (numDeletedRows === 0n) {
      throw new NotFoundError("Team does not exist");
    }
    await this.auditLogService.log({
      actor,
      operation: "team.delete",
      entities: [`${ActorType.TEAM}:${id}`],
      data: message,
    });
  }

  /**
   * Joins a user to a team using a joining code.
   * @param userId
   * @param code
   */
  async join(user_id: number, code: string) {
    const { id: team_id, flags } =
      (await this.databaseClient
        .get()
        .selectFrom("core.team")
        .select(["id", "flags"])
        .where("join_code", "=", code)
        .executeTakeFirst()) || {};
    if (
      !team_id ||
      flags.includes(TeamFlag.FROZEN) ||
      flags.includes(TeamFlag.BLOCKED)
    ) {
      throw new NotFoundError("Invalid joining code");
    }
    await this.assignMember(
      {
        user_id,
        team_id,
      },
      {
        actor: {
          type: ActorType.USER,
          id: user_id,
        },
        message: "Joined using code",
      },
    );
    return team_id;
  }

  async getMembership(userId: number) {
    const result = await this.databaseClient
      .get()
      .selectFrom("core.team_member")
      .select(["team_id", "role"])
      .where("user_id", "=", userId)
      .executeTakeFirst();

    if (!result) {
      return null;
    }
    return result;
  }

  async assignMember(
    {
      user_id,
      team_id,
      role = "member",
    }: {
      user_id: number;
      team_id: number;
      role?: CoreTeamMemberRole;
    },
    { actor, message }: AuditParams = {},
  ) {
    const { numInsertedOrUpdatedRows } = await this.databaseClient
      .get()
      .insertInto("core.team_member")
      .values({
        user_id,
        team_id,
        role,
      })
      .onConflict((b) =>
        b
          .column("user_id")
          .doUpdateSet({ role })
          .where("core.team_member.team_id", "=", team_id)
          .where("core.team_member.role", "!=", role),
      )
      .executeTakeFirst();
    if (numInsertedOrUpdatedRows === 0n) {
      throw new ConflictError("User has already joined a team.");
    }
    await this.auditLogService.log({
      actor,
      operation: "team.member.assign",
      entities: [
        `${ActorType.TEAM}:${team_id}`,
        `${ActorType.USER}:${user_id}`,
      ],
      data: message,
    });
  }

  async removeMember(
    {
      user_id,
      team_id,
      check_owner,
    }: {
      user_id: number;
      team_id: number;
      check_owner?: boolean;
    },
    { actor, message }: AuditParams,
  ) {
    let query = this.databaseClient
      .get()
      .deleteFrom("core.team_member")
      .where("user_id", "=", user_id)
      .where("team_id", "=", team_id);
    if (check_owner) {
      query = query.where((op) =>
        op.or([
          op(
            op
              .selectFrom("core.team_member")
              .select((o) => o.fn.countAll().as("cnt"))
              .where("team_id", "=", team_id)
              .where("user_id", "!=", user_id)
              .where("role", "=", "owner"),
            "!=",
            0,
          ),
          op(
            op
              .selectFrom("core.team_member")
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
    await this.auditLogService.log({
      actor,
      operation: "team.member.remove",
      entities: [
        `${ActorType.TEAM}:${team_id}`,
        `${ActorType.USER}:${user_id}`,
      ],
      data: message,
    });
  }

  async getMembers(teamId: number) {
    return await this.databaseClient
      .get()
      .selectFrom("core.team_member")
      .select(["user_id", "role"])
      .where("team_id", "=", teamId)
      .execute();
  }
}
