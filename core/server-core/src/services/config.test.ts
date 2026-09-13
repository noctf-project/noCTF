import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mockDeep, DeepMockProxy } from "vitest-mock-extended";
import { ConfigService } from "./config.ts";
import { ConfigDAO } from "../dao/config.ts";
import { DatabaseClient } from "../clients/database.ts";
import { CacheService } from "./cache.ts";
import { AuditLogService } from "./audit_log.ts";
import { EventBusService } from "./event_bus.ts";
import { Logger } from "../types/primitives.ts";
import { ValidationError } from "../errors.ts";
import { ConfigUpdateEvent } from "@noctf/api/events";
import { Type } from "@sinclair/typebox";

vi.mock(import("../dao/config.ts"));

const DummySchema = Type.Object(
  {
    title: Type.String(),
    enabled: Type.Boolean(),
  },
  { $id: "dummy" },
);

describe(ConfigService, () => {
  let logger: DeepMockProxy<Logger>;
  let databaseClient: DeepMockProxy<DatabaseClient>;
  let cacheService: DeepMockProxy<CacheService>;
  let auditLogService: DeepMockProxy<AuditLogService>;
  let eventBusService: DeepMockProxy<EventBusService>;
  let configDAO: DeepMockProxy<ConfigDAO>;
  let service: ConfigService;

  beforeEach(() => {
    logger = mockDeep<Logger>();
    databaseClient = mockDeep<DatabaseClient>();
    cacheService = mockDeep<CacheService>();
    auditLogService = mockDeep<AuditLogService>();
    eventBusService = mockDeep<EventBusService>();
    configDAO = mockDeep<ConfigDAO>();

    vi.mocked(ConfigDAO).mockReturnValue(configDAO);

    service = new ConfigService({
      logger,
      databaseClient,
      cacheService,
      auditLogService,
      eventBusService,
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("register & get", () => {
    it("registers schema and populates default values", async () => {
      configDAO.register.mockResolvedValue(true);

      await service.register(DummySchema, { title: "Test", enabled: true });

      expect(configDAO.register).toHaveBeenCalledWith("dummy", {
        title: "Test",
        enabled: true,
      });
      expect(service.getSchemas()).toEqual([
        { namespace: "dummy", schema: DummySchema },
      ]);
    });

    it("throws ValidationError if getting unregistered namespace", async () => {
      await expect(service.get("unknown_ns")).rejects.toThrow(
        "Config namespace does not exist",
      );
    });

    it("fetches and caches config value", async () => {
      await service.register(DummySchema, { title: "Test", enabled: true });

      configDAO.get.mockResolvedValue({
        version: 1,
        value: { title: "Custom", enabled: false },
      });

      const first = await service.get(DummySchema);
      const second = await service.get(DummySchema);

      expect(first).toEqual({
        version: 1,
        value: { title: "Custom", enabled: false },
      });
      expect(second).toEqual(first);
      // DAO should only be called once due to caching
      expect(configDAO.get).toHaveBeenCalledTimes(1);
    });
  });

  describe("update", () => {
    beforeEach(async () => {
      await service.register(
        DummySchema,
        { title: "Initial", enabled: true },
        (v) => {
          if (v.title === "invalid_custom") {
            throw new Error("Custom validator rejection");
          }
        },
      );
    });

    it("throws ValidationError if schema validation fails", async () => {
      await expect(
        service.update({
          namespace: "dummy",
          value: { title: 123, enabled: true } as unknown as {
            title: string;
            enabled: boolean;
          },
        }),
      ).rejects.toThrow(ValidationError);
    });

    it("throws ValidationError if custom validator fails", async () => {
      await expect(
        service.update({
          namespace: "dummy",
          value: { title: "invalid_custom", enabled: true },
        }),
      ).rejects.toThrow(
        "Custom validation function failed with error: Custom validator rejection",
      );
    });

    it("updates DAO, logs audit, and publishes update event", async () => {
      const now = new Date();
      configDAO.update.mockResolvedValue({
        version: 2,
        updated_at: now,
      });

      const result = await service.update({
        namespace: "dummy",
        value: { title: "Updated Title", enabled: true },
      });

      expect(configDAO.update).toHaveBeenCalledWith(
        "dummy",
        { title: "Updated Title", enabled: true },
        undefined,
      );
      expect(auditLogService.log).toHaveBeenCalledWith({
        actor: undefined,
        operation: "config.update",
        entities: ["config:dummy"],
        data: "Updated to version 2",
      });
      expect(eventBusService.publish).toHaveBeenCalledWith(ConfigUpdateEvent, {
        namespace: "dummy",
        version: 2,
        updated_at: now,
      });
      expect(result).toEqual({
        version: 2,
        value: { title: "Updated Title", enabled: true },
      });
    });
  });
});
