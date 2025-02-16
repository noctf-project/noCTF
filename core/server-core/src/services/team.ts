import { NotFoundError } from "../errors.ts";
import { TeamFlag } from "../types/enums.ts";
import type { ServiceCradle } from "../index.ts";
import { nanoid } from "nanoid";
import type { AuditParams } from "../types/audit_log.ts";
import { ActorType } from "../types/enums.ts";
import { TeamConfig } from "@noctf/api/config";
import { TeamDAO } from "../dao/team.ts";

type Props = Pick<
  ServiceCradle,
  "configService" | "databaseClient" | "auditLogService"
>;

export class TeamService {
  private readonly databaseClient;
  private readonly auditLogService;
  private readonly configService;
  private readonly dao = new TeamDAO();

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
    const team = await this.dao.create(this.databaseClient.get(), {
      name,
      join_code,
      flags: flags || [],
    });

    await this.auditLogService.log({
      operation: "team.create",
      actor,
      data: message,
      entities: [`${ActorType.TEAM}:${team.id}`],
    });
    return team;
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
    let j: string | null | undefined;
    if (join_code === "refresh") {
      j = nanoid();
    } else if (join_code === "remove") {
      j = null;
    }

    await this.dao.update(this.databaseClient.get(), id, {
      name,
      bio,
      join_code: j,
      flags,
    });
    await this.auditLogService.log({
      operation: "team.update",
      actor,
      data: message,
      entities: [`${ActorType.TEAM}:${id}`],
    });
  }

  async get(id: number) {
    return this.dao.get(this.databaseClient.get(), id);
  }

  async list(flags?: string[]) {
    return this.dao.list(this.databaseClient.get(), flags);
  }

  async delete(id: number, { actor, message }: AuditParams = {}) {
    await this.dao.delete(this.databaseClient.get(), id);
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
    const result = await this.dao.findUsingJoinCode(
      this.databaseClient.get(),
      code,
    );
    if (
      !result.flags.includes(TeamFlag.FROZEN) ||
      !result.flags.includes(TeamFlag.BLOCKED)
    ) {
      throw new NotFoundError("Team not found");
    }
    await this.dao.assign(this.databaseClient.get(), {
      user_id,
      team_id: result.id,
      role: "member",
    });
    await this.auditLogService.log({
      actor: {
        type: ActorType.USER,
        id: user_id,
      },
      operation: "team.member.assign",
      entities: [
        `${ActorType.TEAM}:${result.id}`,
        `${ActorType.USER}:${user_id}`,
      ],
      data: "Joined using code",
    });

    return result.id;
  }

  async getMembershipForUser(userId: number) {
    return this.dao.getMembershipForUser(this.databaseClient.get(), userId);
  }

  async assignMember(
    v: Parameters<TeamDAO["assign"]>[1],
    { actor, message }: AuditParams = {},
  ) {
    await this.dao.assign(this.databaseClient.get(), v);
    await this.auditLogService.log({
      actor,
      operation: "team.member.assign",
      entities: [
        `${ActorType.TEAM}:${v.team_id}`,
        `${ActorType.USER}:${v.user_id}`,
      ],
      data: message,
    });
  }

  async unassignMember(
    v: Parameters<TeamDAO["unassign"]>[1],
    { actor, message }: AuditParams,
  ) {
    await this.auditLogService.log({
      actor,
      operation: "team.member.remove",
      entities: [
        `${ActorType.TEAM}:${v.team_id}`,
        `${ActorType.USER}:${v.user_id}`,
      ],
      data: message,
    });
  }

  async listMembers(teamId: number) {
    return await this.dao.listMembers(this.databaseClient.get(), teamId);
  }
}
