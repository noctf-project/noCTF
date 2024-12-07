import { ForbiddenError, NotFoundError } from "../errors.ts";
import { TeamFlag } from "../types/enums.ts";
import { CoreTeamMemberRole } from "@noctf/schema";
import type { ServiceCradle } from "../index.ts";
import { nanoid } from "nanoid";
import { AuditLogActor, AuditParams } from "../types/audit_log.ts";
import { ActorType } from "../types/enums.ts";

type Props = Pick<
  ServiceCradle,
  "databaseClient" | "cacheClient" | "auditLogService"
>;

export class TeamService {
  private readonly cacheClient: Props["cacheClient"];
  private readonly databaseClient: Props["databaseClient"];
  private readonly auditLogService: Props["auditLogService"];

  constructor({ databaseClient, cacheClient, auditLogService }: Props) {
    this.cacheClient = cacheClient;
    this.databaseClient = databaseClient;
    this.auditLogService = auditLogService;
  }

  async create({
    name,
    flags = [],
    generateJoinCode,
    audit: { actor, message },
  }: {
    name: string;
    flags: string[];
    generateJoinCode?: boolean;
    audit?: AuditParams;
  }) {
    const { id } = await this.databaseClient
      .insertInto("core.team")
      .values({
        name,
        join_code: generateJoinCode && nanoid(),
        flags,
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    void this.auditLogService.log({
      operation: "team.create",
      actor: actor || {
        type: ActorType.SYSTEM,
      },
      data: message,
      entity: `${ActorType.TEAM}:${id}`,
    });
    return id;
  }

  async delete(
    id: number,
    {
      actor,
      message,
    }: AuditParams = {},
  ) {
    const { numDeletedRows } = await this.databaseClient
      .deleteFrom("core.team")
      .where("id", "=", id)
      .executeTakeFirst();
    if (numDeletedRows === 0n) {
      throw new NotFoundError("Team does not exist");
    }
    void this.auditLogService.log({
      actor: actor || {
        type: ActorType.SYSTEM,
      },
      operation: "team.delete",
      entity: `${ActorType.TEAM}:${id}`,
      data: message,
    });
  }

  /**
   * Joins a user to a team using a joining code.
   * @param userId
   * @param code
   */
  async join(userId: number, code: string) {
    const { id: teamId, flags } = await this.databaseClient
      .selectFrom("core.team")
      .select(["id", "flags"])
      .where("join_code", "=", code)
      .executeTakeFirst() || {};
    if (
      !teamId ||
      flags.includes(TeamFlag.FROZEN) ||
      flags.includes(TeamFlag.BLOCKED)
    ) {
      throw new NotFoundError("Invalid joining code");
    }
    await this.assignUser({
      userId,
      teamId,
      audit: {
        actor: {
          type: ActorType.USER,
          id: userId,
        },
        message: "Joined using code",
      },
    });
  }

  async assignUser({
    userId,
    teamId,
    role = "member",
    audit: { actor, message } = {},
  }: {
    userId: number;
    teamId: number;
    role?: CoreTeamMemberRole;
    audit?: AuditParams;
  }) {
    const { numInsertedOrUpdatedRows } = await this.databaseClient
      .insertInto("core.team_member")
      .values({
        user_id: userId,
        team_id: teamId,
        role,
      })
      .onConflict((b) =>
        b.column("user_id").doUpdateSet({ role })
        .where("core.team_member.team_id", "=", teamId)
        .where("core.team_member.role", "!=", role),
      )
      .executeTakeFirst();
    if (numInsertedOrUpdatedRows === 0n) {
      throw new ForbiddenError("User has already joined a team.");
    }
    void this.auditLogService.log({
      actor: actor || {
        type: ActorType.SYSTEM,
      },
      operation: "team.member.assign",
      entity: `${ActorType.TEAM}:${teamId}`,
      data: message,
    });
  }

  async unassignUser(
    userId: number,
    teamId: number,
    { actor, message }: AuditParams = {}) {
    const {numDeletedRows} = await this.databaseClient
      .deleteFrom("core.team_member")
      .where("user_id", "=", userId)
      .where("team_id", "=", teamId)
      .executeTakeFirst();
    if (numDeletedRows === 0n) {
      throw new NotFoundError("User's membership does not exist.");
    }
    void this.auditLogService.log({
      actor: actor || {
        type: ActorType.SYSTEM,
      },
      operation: "team.member.unassign",
      entity: `${ActorType.TEAM}:${teamId}`,
      data: message,
    });
  }

  async getMembers(teamId: number) {
    return await this.databaseClient
      .selectFrom("core.team_member")
      .select(["user_id", "role"])
      .where("team_id", "=", teamId)
      .execute();
  }
}
