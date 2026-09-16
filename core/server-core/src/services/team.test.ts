import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mockDeep, DeepMockProxy } from "vitest-mock-extended";
import type { DB } from "@noctf/schema";
import type { Transaction } from "kysely";
import { TeamService } from "./team.ts";
import { ConfigService } from "./config.ts";
import { DatabaseClient } from "../clients/database.ts";
import { AuditLogService } from "./audit_log.ts";
import { EventBusService } from "./event_bus.ts";
import { TeamDAO } from "../dao/team.ts";
import { TeamTagDAO } from "../dao/team_tag.ts";
import { ConflictError, ForbiddenError, NotFoundError } from "../errors.ts";
import { ActorType, TeamFlag } from "../types/enums.ts";
import { TeamUpdateEvent } from "@noctf/api/events";

vi.mock(import("../dao/team.ts"));
vi.mock(import("../dao/team_tag.ts"));

describe(TeamService, () => {
  let configService: DeepMockProxy<ConfigService>;
  let databaseClient: DeepMockProxy<DatabaseClient>;
  let auditLogService: DeepMockProxy<AuditLogService>;
  let eventBusService: DeepMockProxy<EventBusService>;
  let teamDAO: DeepMockProxy<TeamDAO>;
  let teamTagDAO: DeepMockProxy<TeamTagDAO>;
  let service: TeamService;

  beforeEach(() => {
    configService = mockDeep<ConfigService>();
    databaseClient = mockDeep<DatabaseClient>();
    auditLogService = mockDeep<AuditLogService>();
    eventBusService = mockDeep<EventBusService>();
    teamDAO = mockDeep<TeamDAO>();
    teamTagDAO = mockDeep<TeamTagDAO>();

    vi.mocked(TeamDAO).mockImplementation(function () {
      return teamDAO;
    });
    vi.mocked(TeamTagDAO).mockImplementation(function () {
      return teamTagDAO;
    });

    const txMock = mockDeep<Transaction<DB>>();
    type TxArg = Parameters<
      Parameters<typeof databaseClient.transaction>[0]
    >[0];
    databaseClient.transaction.mockImplementation((async (
      cb: (tx: TxArg) => Promise<unknown>,
    ) => {
      return await cb(txMock as unknown as TxArg);
    }) as typeof databaseClient.transaction);

    service = new TeamService({
      configService,
      databaseClient,
      auditLogService,
      eventBusService,
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("create", () => {
    it("creates a team and audits the action", async () => {
      teamDAO.create.mockResolvedValue({
        id: 1,
        name: "CyberTeam",
        division_id: 1,
        flags: [],
        bio: "",
        country: null,
        join_code: null,
        created_at: new Date(1000),
        updated_at: new Date(1000),
      });

      const result = await service.create(
        {
          name: "CyberTeam",
          division_id: 1,
          tag_ids: [10, 20],
        },
        { actor: { type: ActorType.USER, id: 99 }, message: "created" },
      );

      expect(teamDAO.create).toHaveBeenCalledWith({
        name: "CyberTeam",
        join_code: null,
        division_id: 1,
        flags: [],
      });
      expect(teamTagDAO.assign).toHaveBeenCalledWith(1, [10, 20]);
      expect(auditLogService.log).toHaveBeenCalledWith({
        operation: "team.create",
        actor: { type: ActorType.USER, id: 99 },
        data: "created",
        entities: ["team:1"],
      });
      expect(result.id).toBe(1);
      expect(result.tag_ids).toEqual([10, 20]);
      expect(eventBusService.publish).toHaveBeenCalledWith(TeamUpdateEvent, {
        id: 1,
        division_id: 1,
        flags: [],
        type: "create",
        updated_at: new Date(1000),
      });
    });

    it("generates a join code when generate_join_code is true", async () => {
      teamDAO.create.mockResolvedValue({
        id: 2,
        name: "JoinCodeTeam",
        division_id: 1,
        flags: [],
        bio: "",
        country: null,
        join_code: "ABC123XYZ",
        created_at: new Date(1000),
        updated_at: new Date(1000),
      });

      await service.create({
        name: "JoinCodeTeam",
        division_id: 1,
        generate_join_code: true,
      });

      expect(teamDAO.create).toHaveBeenCalledWith(
        expect.objectContaining({
          join_code: expect.any(String),
        }),
      );
    });
  });

  describe("update", () => {
    it("updates a team, audits and publishes TeamUpdateEvent", async () => {
      teamDAO.update.mockResolvedValue({
        division_id: 2,
        flags: [],
        updated_at: new Date(2000),
      });

      await service.update(
        1,
        {
          name: "CyberTeam2",
          division_id: 2,
          tag_ids: [10, 30],
        },
        { actor: { type: ActorType.USER, id: 99 }, message: "updated" },
      );

      expect(teamDAO.update).toHaveBeenCalled();
      expect(auditLogService.log).toHaveBeenCalledWith({
        operation: "team.update",
        actor: { type: ActorType.USER, id: 99 },
        data: "updated",
        entities: ["team:1"],
      });
      expect(eventBusService.publish).toHaveBeenCalledWith(TeamUpdateEvent, {
        id: 1,
        division_id: 2,
        flags: [],
        type: "update",
        updated_at: new Date(2000),
      });
    });
  });

  describe("delete", () => {
    it("deletes a team, audits and publishes TeamUpdateEvent", async () => {
      teamDAO.delete.mockResolvedValue({
        id: 1,
        division_id: 1,
        flags: [],
        updated_at: new Date(3000),
      });

      await service.delete(1, {
        actor: { type: ActorType.USER, id: 99 },
        message: "removed",
      });

      expect(teamDAO.delete).toHaveBeenCalledWith(1);
      expect(auditLogService.log).toHaveBeenCalledWith({
        actor: { type: ActorType.USER, id: 99 },
        operation: "team.delete",
        entities: ["team:1"],
        data: "removed",
      });
      expect(eventBusService.publish).toHaveBeenCalledWith(TeamUpdateEvent, {
        id: 1,
        division_id: 1,
        flags: [],
        type: "delete",
        updated_at: new Date(3000),
      });
    });
  });

  describe("join", () => {
    it("throws NotFoundError if team has FROZEN or BLOCKED flag", async () => {
      teamDAO.findUsingJoinCode.mockResolvedValue({
        id: 5,
        flags: [TeamFlag.FROZEN],
      });

      await expect(service.join(1, "validcode")).rejects.toThrow(NotFoundError);
    });

    it("throws ForbiddenError if team member limit is exceeded", async () => {
      teamDAO.findUsingJoinCode.mockResolvedValue({
        id: 5,
        flags: [],
      });
      configService.get.mockResolvedValue({
        version: 1,
        value: { max_members: 3 },
      });
      teamDAO.listMembers.mockImplementation(((
        _id: number,
        count?: boolean,
      ) => {
        if (count) return Promise.resolve(4);
        return Promise.resolve([]);
      }) as typeof teamDAO.listMembers);

      await expect(service.join(1, "validcode")).rejects.toThrow(
        ForbiddenError,
      );
    });

    it("successfully assigns user to team when within limit", async () => {
      teamDAO.findUsingJoinCode.mockResolvedValue({
        id: 7,
        flags: [],
      });
      configService.get.mockResolvedValue({
        version: 1,
        value: { max_members: 4 },
      });
      teamDAO.listMembers.mockImplementation(((
        _id: number,
        count?: boolean,
      ) => {
        if (count) return Promise.resolve(2);
        return Promise.resolve([]);
      }) as typeof teamDAO.listMembers);

      const teamId = await service.join(42, "MYCODE123");

      expect(teamDAO.findUsingJoinCode).toHaveBeenCalledWith("MYCODE123");
      expect(teamDAO.assign).toHaveBeenCalledWith({
        user_id: 42,
        team_id: 7,
        role: "member",
      });
      expect(auditLogService.log).toHaveBeenCalledWith({
        actor: { type: ActorType.USER, id: 42 },
        operation: "team.member.assign",
        entities: ["team:7", "user:42"],
        data: "Joined using code",
      });
      expect(teamId).toBe(7);
    });
  });

  describe("assignMember", () => {
    it("assigns member directly when no conflict occurs", async () => {
      await service.assignMember(
        { team_id: 1, user_id: 10, role: "member" },
        { message: "added" },
      );

      expect(teamDAO.assign).toHaveBeenCalledWith({
        team_id: 1,
        user_id: 10,
        role: "member",
      });
      expect(auditLogService.log).toHaveBeenCalledWith({
        actor: undefined,
        operation: "team.member.assign",
        entities: ["team:1", "user:10"],
        data: "added",
      });
    });

    it("performs atomic owner swap when assigning an owner causes ConflictError", async () => {
      const conflictErr = new ConflictError("duplicate owner", {
        cause: new Error(),
      });
      teamDAO.assign.mockRejectedValueOnce(conflictErr);

      teamDAO.listMembers.mockResolvedValue([
        { user_id: 1, role: "owner" },
        { user_id: 2, role: "member" },
      ]);

      await service.assignMember(
        { team_id: 10, user_id: 2, role: "owner" },
        { message: "promoted to owner" },
      );

      expect(teamDAO.unassign).toHaveBeenCalledWith({
        user_id: 1,
        team_id: 10,
      });
      expect(teamDAO.assign).toHaveBeenCalledWith({
        user_id: 2,
        team_id: 10,
        role: "owner",
      });
      expect(teamDAO.assign).toHaveBeenCalledWith({
        user_id: 1,
        team_id: 10,
        role: "member",
      });
    });
  });

  describe("unassignMember", () => {
    it("unassigns member and writes audit log", async () => {
      await service.unassignMember(
        { team_id: 5, user_id: 12 },
        { message: "kicked" },
      );

      expect(teamDAO.unassign).toHaveBeenCalledWith({
        team_id: 5,
        user_id: 12,
      });
      expect(auditLogService.log).toHaveBeenCalledWith({
        actor: undefined,
        operation: "team.member.remove",
        entities: ["team:5", "user:12"],
        data: "kicked",
      });
    });
  });

  describe("validateTagsJoinable", () => {
    it("throws NotFoundError if requested tag is not joinable", async () => {
      teamTagDAO.list.mockResolvedValue([
        {
          id: 1,
          is_joinable: false,
          name: "Hidden",
          description: "",
          created_at: new Date(),
        },
      ]);

      await expect(service.validateTagsJoinable([1])).rejects.toThrow(
        NotFoundError,
      );
    });

    it("passes when all requested tags are joinable", async () => {
      teamTagDAO.list.mockResolvedValue([
        {
          id: 2,
          is_joinable: true,
          name: "Open",
          description: "",
          created_at: new Date(),
        },
      ]);

      await expect(service.validateTagsJoinable([2])).resolves.toBeUndefined();
    });
  });
});
