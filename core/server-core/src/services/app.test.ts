import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { any, anyString, mock, mockDeep } from "vitest-mock-extended";
import { CacheService } from "@noctf/server-core/services/cache";
import { IdentityService } from "@noctf/server-core/services/identity";
import {
  AppService,
  AuthorizationCodeContext,
  CACHE_NAMESPACE,
  DEFAULT_EXPIRY_SECONDS,
} from "./app.ts";
import { AppDAO } from "../dao/app.ts";
import { DatabaseClient } from "../clients/database.ts";
import { App } from "@noctf/api/datatypes";
import { nanoid } from "nanoid";
import { BadRequestError } from "../errors.ts";
import { LockService } from "./lock.ts";

vi.mock("nanoid", () => ({
  nanoid: vi.fn(),
}));

vi.mock(import("../dao/app.ts"));

const ENABLED_APP_1: App = {
  id: 1,
  client_id: "test-client",
  client_secret: "test-secret",
  name: "",
  redirect_uris: ["https://auth.example.com/"],
  scopes: [],
  enabled: true,
  created_at: new Date(0),
  updated_at: new Date(0),
};

describe(AppService, () => {
  const cacheService = mockDeep<CacheService>();
  const identityService = mockDeep<IdentityService>();
  const lockService = mockDeep<LockService>();
  const databaseClient = mockDeep<DatabaseClient>();
  const appDAO = mockDeep<AppDAO>();

  let service: AppService;

  beforeEach(() => {
    vi.mocked(AppDAO).mockReturnValue(appDAO);
    lockService.withLease.mockImplementation((_, a) => a());
    service = new AppService({
      cacheService,
      identityService,
      lockService,
      databaseClient,
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe(AppService.prototype.generateAuthorizationCode, () => {
    beforeEach(() => {
      vi.mocked(nanoid).mockReturnValue("test-code");
    });

    it("should generate code and store in cache", async () => {
      appDAO.getByActiveClientID.mockResolvedValue(ENABLED_APP_1);

      const code = await service.generateAuthorizationCode(
        "test-client",
        "https://auth.example.com/",
        1,
        ["read"],
      );
      expect(code).toBe("test-code");
      expect(cacheService.put).toBeCalledWith(
        CACHE_NAMESPACE,
        anyString(),
        {
          app_id: 1,
          user_id: 1,
          redirect_uri: "https://auth.example.com/",
          scopes: ["read"],
        },
        DEFAULT_EXPIRY_SECONDS,
      );
    });

    it("should not generate code if redirect uri is not in config", async () => {
      appDAO.getByActiveClientID.mockResolvedValue(ENABLED_APP_1);

      await expect(
        service.generateAuthorizationCode(
          "test-client",
          "https://invalid.example.com/",
          1,
          ["read"],
        ),
      ).rejects.toThrowError(BadRequestError);
      expect(cacheService.put).not.toHaveBeenCalled();
    });
  });

  describe(AppService.prototype.exchangeAuthorizationCodeForToken, () => {
    it("should exchange valid code for token", async () => {
      const mockContext: AuthorizationCodeContext = {
        user_id: 1,
        app_id: 1,
        scopes: ["read"],
        redirect_uri: "https://auth.example.com/",
      };
      const mockToken = "generated-token";

      cacheService.get.mockResolvedValue(mockContext);
      identityService.createSession.mockResolvedValue({
        access_token: mockToken,
        refresh_token: "s",
        expires_in: 3600,
      });

      const result = await service.exchangeAuthorizationCodeForToken(
        "test-client",
        "test-secret",
        "https://auth.example.com/",
        "test-code",
      );

      expect(result).toEqual({
        access_token: mockToken,
        refresh_token: "s",
      });
      expect(cacheService.del).toHaveBeenCalledWith(
        CACHE_NAMESPACE,
        anyString(),
      );
      expect(identityService.createSession).toHaveBeenCalledWith(
        {
          app_id: 1,
          user_id: 1,
          scopes: ["read"],
        },
        false,
      );
    });

    it("should not exchange if invalid URL", async () => {
      const mockContext: AuthorizationCodeContext = {
        user_id: 1,
        app_id: 1,
        scopes: ["read"],
        redirect_uri: "https://auth.example.com/",
      };

      cacheService.get.mockResolvedValue(mockContext);

      await expect(
        service.exchangeAuthorizationCodeForToken(
          "test-client",
          "test-secret",
          "https://invalid.example.com/",
          "test-code",
        ),
      ).rejects.toThrowError(BadRequestError);
      expect(lockService.withLease).toBeCalledWith(anyString(), any());
      expect(identityService.createSession).not.toHaveBeenCalled();
    });

    it("should not exchange if code not found", async () => {
      await expect(
        service.exchangeAuthorizationCodeForToken(
          "test-client",
          "test-secret",
          "https://invalid.example.com/",
          "test-code",
        ),
      ).rejects.toThrowError(BadRequestError);

      expect(lockService.withLease).toBeCalledWith(anyString(), any());
      expect(identityService.createSession).not.toHaveBeenCalled();
    });
  });
});
