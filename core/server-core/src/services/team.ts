import { NotFoundError } from "../errors.ts";
import { TeamFlag } from "../types/enums.ts";
import type { ServiceCradle } from "../index.ts";
import { nanoid } from "nanoid";
import type { AuditParams } from "../types/audit_log.ts";
import { ActorType } from "../types/enums.ts";
import { TeamConfig } from "@noctf/api/config";
import { TeamDAO } from "../dao/team.ts";
import { DivisionDAO } from "../dao/division.ts";
import { LocalCache } from "../util/local_cache.ts";
import { TeamMembership } from "@noctf/api/datatypes";
import { TeamTagDAO } from "../dao/team_tag.ts";

type Props = Pick<
  ServiceCradle,
  "configService" | "databaseClient" | "auditLogService"
>;

export class TeamService {
  private readonly auditLogService;
  private readonly configService;

  private readonly divisionDAO;
  private readonly teamDAO;
  private readonly teamTagDAO;
  private readonly membershipCache = new LocalCache<
    number,
    TeamMembership | null
  >({
    max: 10000,
    ttl: 10000,
  });

  constructor({ configService, databaseClient, auditLogService }: Props) {
    this.auditLogService = auditLogService;
    this.configService = configService;
    this.divisionDAO = new DivisionDAO(databaseClient.get());
    this.teamDAO = new TeamDAO(databaseClient.get());
    this.teamTagDAO = new TeamTagDAO(databaseClient.get());
    void this.init();
  }

  async init() {
    await this.configService.register(TeamConfig, { max_members: 0 });
  }

  async listTags() {
    return this.teamTagDAO.list();
  }

  async listDivisions() {
    return this.divisionDAO.list();
  }

  async getDivision(id: number) {
    return this.divisionDAO.get(id);
  }

  async create(
    {
      name,
      division_id,
      flags,
      generate_join_code,
    }: {
      name: string;
      division_id: number;
      flags?: string[];
      generate_join_code?: boolean;
      audit?: AuditParams;
    },
    { actor, message }: AuditParams = {},
  ) {
    const join_code = generate_join_code ? nanoid() : null;
    const team = await this.teamDAO.create({
      name,
      join_code,
      division_id,
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
      division_id,
      flags,
    }: {
      name?: string;
      bio?: string;
      flags?: string[];
      division_id?: number;
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

    await this.teamDAO.update(id, {
      name,
      bio,
      join_code: j,
      division_id,
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
    return this.teamDAO.get(id);
  }

  async listSummary(
    params?: {
      flags?: string[];
      division_id?: number;
      ids?: number[];
    },
    limit?: { limit?: number; offset?: number },
  ) {
    return this.teamDAO.listSummary(params, limit);
  }

  async getCount(params?: {
    flags?: string[];
    division_id?: number;
    ids?: number[];
  }) {
    return this.teamDAO.getCount(params);
  }

  async queryNames(ids: number[], includeHidden?: boolean) {
    return this.teamDAO.queryNames(ids, includeHidden);
  }
  async delete(id: number, { actor, message }: AuditParams = {}) {
    await this.teamDAO.delete(id);
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
    const result = await this.teamDAO.findUsingJoinCode(code);
    if (
      result.flags.includes(TeamFlag.FROZEN) ||
      result.flags.includes(TeamFlag.BLOCKED)
    ) {
      throw new NotFoundError("Team not found");
    }
    await this.teamDAO.assign({
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

  async getMembershipForUser(userId: number): Promise<TeamMembership | null> {
    return this.membershipCache.load(userId, () =>
      this.teamDAO.getMembershipForUser(userId),
    );
  }

  async assignMember(
    v: Parameters<TeamDAO["assign"]>[0],
    { actor, message }: AuditParams = {},
  ) {
    await this.teamDAO.assign(v);
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
    v: Parameters<TeamDAO["unassign"]>[0],
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
    return await this.teamDAO.listMembers(teamId);
  }
}
