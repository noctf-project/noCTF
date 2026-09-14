import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mockDeep, DeepMockProxy } from "vitest-mock-extended";
import { AnnouncementService } from "./announcement.ts";
import { AnnouncementDAO } from "../dao/announcement.ts";
import { DatabaseClient } from "../clients/database.ts";
import { AuditLogService } from "./audit_log.ts";
import { ConfigService } from "./config.ts";
import { EventBusService } from "./event_bus.ts";
import { ConflictError } from "../errors.ts";
import { AnnouncementUpdateEvent } from "@noctf/api/events";
import { EntityType, ActorType } from "../types/enums.ts";
import { Announcement } from "@noctf/api/datatypes";

vi.mock(import("../dao/announcement.ts"));

describe(AnnouncementService, () => {
  let auditLogService: DeepMockProxy<AuditLogService>;
  let databaseClient: DeepMockProxy<DatabaseClient>;
  let configService: DeepMockProxy<ConfigService>;
  let eventBusService: DeepMockProxy<EventBusService>;
  let announcementDAO: DeepMockProxy<AnnouncementDAO>;
  let service: AnnouncementService;

  beforeEach(() => {
    auditLogService = mockDeep<AuditLogService>();
    databaseClient = mockDeep<DatabaseClient>();
    configService = mockDeep<ConfigService>();
    eventBusService = mockDeep<EventBusService>();
    announcementDAO = mockDeep<AnnouncementDAO>();

    vi.mocked(AnnouncementDAO).mockImplementation(function () {
      return announcementDAO;
    });

    service = new AnnouncementService({
      auditLogService,
      databaseClient,
      configService,
      eventBusService,
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("isPrivate static check", () => {
    it("returns true for empty visible_to list", () => {
      expect(AnnouncementService.isPrivate([])).toBe(true);
    });

    it("returns false for public or general user announcements", () => {
      expect(AnnouncementService.isPrivate(["public"])).toBe(false);
      expect(AnnouncementService.isPrivate(["user"])).toBe(false);
      expect(AnnouncementService.isPrivate(["role:admin"])).toBe(false);
    });

    it("returns true for team or specific user targeted announcements", () => {
      expect(AnnouncementService.isPrivate(["team:1"])).toBe(true);
      expect(AnnouncementService.isPrivate(["user:42"])).toBe(true);
    });
  });

  describe("create", () => {
    it("throws BadRequestError if webhook delivery is used on private announcement", async () => {
      await expect(
        service.create({
          title: "Private note",
          message: "Hi team 1",
          visible_to: ["team:1"],
          delivery_channels: ["webhook:discord"],
          created_by: null,
          updated_by: null,
          important: false,
        }),
      ).rejects.toThrow("Private announcements may not be made to webhoooks");
    });

    it("creates announcement, audits action, and publishes update event", async () => {
      const createdItem: Announcement = {
        id: 1,
        title: "CTF Started",
        message: "Good luck!",
        created_by: null,
        updated_by: null,
        important: false,
        visible_to: ["public"],
        delivery_channels: [],
        version: 1,
        created_at: new Date(1000),
        updated_at: new Date(1000),
      };

      announcementDAO.create.mockResolvedValue(createdItem);

      const result = await service.create(
        {
          title: "CTF Started",
          message: "Good luck!",
          created_by: null,
          updated_by: null,
          important: false,
          visible_to: ["public"],
          delivery_channels: [],
        },
        { actor: { type: ActorType.USER, id: 10 }, message: "launched" },
      );

      expect(announcementDAO.create).toHaveBeenCalled();
      expect(auditLogService.log).toHaveBeenCalledWith({
        operation: "announcement.create",
        actor: { type: ActorType.USER, id: 10 },
        data: "launched",
        entities: [`${EntityType.ANNOUNCEMENT}:1`],
      });
      expect(eventBusService.publish).toHaveBeenCalledWith(
        AnnouncementUpdateEvent,
        expect.objectContaining({
          type: "create",
          id: 1,
          title: "CTF Started",
        }),
      );
      expect(result).toEqual(createdItem);
    });
  });

  describe("update / delete", () => {
    it("throws ConflictError if version check fails on update", async () => {
      announcementDAO.get.mockResolvedValue({
        id: 1,
        title: "Title",
        message: "Content",
        created_by: null,
        updated_by: null,
        important: false,
        visible_to: ["public"],
        delivery_channels: [],
        version: 2,
        created_at: new Date(1000),
        updated_at: new Date(1000),
      });

      await expect(service.update(1, 1, { title: "New" })).rejects.toThrow(
        ConflictError,
      );
    });

    it("deletes announcement and publishes delete event", async () => {
      announcementDAO.delete.mockResolvedValue({
        id: 1,
        title: "Deleted",
        message: "Content",
        created_by: null,
        updated_by: null,
        important: false,
        visible_to: ["public"],
        delivery_channels: [],
        version: 2,
        created_at: new Date(1000),
        updated_at: new Date(1000),
      });

      await service.delete(1, 2, { message: "cleanup" });

      expect(announcementDAO.delete).toHaveBeenCalledWith(1, 2);
      expect(auditLogService.log).toHaveBeenCalledWith({
        operation: "announcement.delete",
        actor: undefined,
        data: "cleanup",
        entities: [`${EntityType.ANNOUNCEMENT}:1`],
      });
      expect(eventBusService.publish).toHaveBeenCalledWith(
        AnnouncementUpdateEvent,
        expect.objectContaining({
          type: "delete",
          id: 1,
          version: 3,
        }),
      );
    });
  });
});
