import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mockDeep, DeepMockProxy } from "vitest-mock-extended";
import { DivisionService } from "./division.ts";
import { DivisionDAO } from "../dao/division.ts";
import { DatabaseClient } from "../clients/database.ts";
import { AuditLogService } from "./audit_log.ts";
import { NotFoundError } from "../errors.ts";
import { ActorType, EntityType } from "../types/enums.ts";
import { Division } from "@noctf/api/datatypes";

vi.mock(import("../dao/division.ts"));

describe(DivisionService, () => {
  let divisionDAO: DeepMockProxy<DivisionDAO>;
  let databaseClient: DeepMockProxy<DatabaseClient>;
  let auditLogService: DeepMockProxy<AuditLogService>;
  let service: DivisionService;

  beforeEach(() => {
    divisionDAO = mockDeep<DivisionDAO>();
    databaseClient = mockDeep<DatabaseClient>();
    auditLogService = mockDeep<AuditLogService>();

    vi.mocked(DivisionDAO).mockReturnValue(divisionDAO);

    service = new DivisionService({
      databaseClient,
      auditLogService,
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("validateJoinable", () => {
    it("throws NotFoundError if division is not found", async () => {
      divisionDAO.get.mockResolvedValue(undefined);

      await expect(service.validateJoinable(1)).rejects.toThrow(NotFoundError);
    });

    it("throws ForbiddenError if division is not joinable", async () => {
      divisionDAO.get.mockResolvedValue({
        id: 1,
        name: "Pro",
        slug: "pro",
        is_joinable: false,
        is_visible: true,
        password: undefined,
        description: "",
        created_at: new Date(),
      });

      await expect(service.validateJoinable(1)).rejects.toThrow(
        "Division is currently not joinable",
      );
    });

    it("throws ForbiddenError if password is required but not provided", async () => {
      divisionDAO.get.mockResolvedValue({
        id: 2,
        name: "Private",
        slug: "private",
        is_joinable: true,
        is_visible: true,
        password: "secretpassword",
        description: "",
        created_at: new Date(),
      });

      await expect(service.validateJoinable(2)).rejects.toThrow(
        "Division requires a password",
      );
    });

    it("throws ForbiddenError if provided password is wrong", async () => {
      divisionDAO.get.mockResolvedValue({
        id: 2,
        name: "Private",
        slug: "private",
        is_joinable: true,
        is_visible: true,
        password: "secretpassword",
        description: "",
        created_at: new Date(),
      });

      await expect(service.validateJoinable(2, "wrong")).rejects.toThrow(
        "Incorrect division password",
      );
    });

    it("passes when password matches", async () => {
      divisionDAO.get.mockResolvedValue({
        id: 2,
        name: "Private",
        slug: "private",
        is_joinable: true,
        is_visible: true,
        password: "secretpassword",
        description: "",
        created_at: new Date(),
      });

      await expect(
        service.validateJoinable(2, "secretpassword"),
      ).resolves.toBeUndefined();
    });

    it("passes when division has no password and is joinable", async () => {
      divisionDAO.get.mockResolvedValue({
        id: 3,
        name: "Open",
        slug: "open",
        is_joinable: true,
        is_visible: true,
        password: undefined,
        description: "",
        created_at: new Date(),
      });

      await expect(service.validateJoinable(3)).resolves.toBeUndefined();
    });
  });

  describe("create, update, delete", () => {
    it("creates division and audits action", async () => {
      const createdDivision: Division = {
        id: 10,
        name: "University",
        slug: "uni",
        is_joinable: true,
        is_visible: true,
        description: "For uni students",
        created_at: new Date(),
      };
      divisionDAO.create.mockResolvedValue(createdDivision);

      const createInput = {
        name: "University",
        slug: "uni",
        description: "For uni students",
        is_joinable: true,
      };
      const result = await service.create(createInput, {
        actor: { type: ActorType.USER, id: 99 },
        message: "created",
      });

      expect(divisionDAO.create).toHaveBeenCalledWith(createInput);
      expect(auditLogService.log).toHaveBeenCalledWith({
        operation: "division.create",
        actor: { type: ActorType.USER, id: 99 },
        data: "created",
        entities: [`${EntityType.DIVISION}:10`],
      });
      expect(result).toEqual(createdDivision);
    });

    it("updates division and audits action", async () => {
      await service.update(
        10,
        { name: "Updated Name" },
        { message: "name updated" },
      );

      expect(divisionDAO.update).toHaveBeenCalledWith(10, {
        name: "Updated Name",
      });
      expect(auditLogService.log).toHaveBeenCalledWith({
        operation: "division.update",
        actor: undefined,
        data: "name updated",
        entities: [`${EntityType.DIVISION}:10`],
      });
    });

    it("deletes division and audits action", async () => {
      await service.delete(10, { message: "deleted" });

      expect(divisionDAO.delete).toHaveBeenCalledWith(10);
      expect(auditLogService.log).toHaveBeenCalledWith({
        operation: "division.delete",
        actor: undefined,
        data: "deleted",
        entities: [`${EntityType.DIVISION}:10`],
      });
    });
  });
});
