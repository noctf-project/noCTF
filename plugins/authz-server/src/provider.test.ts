import { describe, it, expect, beforeEach, vi } from "vitest";
import { mock } from "vitest-mock-extended";
import { OAuthProvider } from "./provider.ts";
import { ConfigService } from "@noctf/server-core/services/config";
import { CacheService } from "@noctf/server-core/services/cache";
import { IdentityService } from "@noctf/server-core/services/identity";

vi.mock("nanoid", () => ({
  nanoid: vi.fn().mockReturnValue("test-code"),
}));

describe("OAuthProvider", () => {
  const mockCacheService = mock<CacheService>();
  const mockConfigService = mock<ConfigService>();
  const mockIdentityService = mock<IdentityService>();

  const mockClient = {
    client_id: "test-client",
    client_secret: "test-secret",
    redirect_uris: ["http://yourapp/oauth/callback"],
  };

  let oauthProvider: OAuthProvider;

  beforeEach(() => {
    mockCacheService.put.mockReset();
    mockCacheService.get.mockReset();
    mockCacheService.del.mockReset();
    mockConfigService.get.mockReset();
    mockIdentityService.generateToken.mockReset();

    oauthProvider = new OAuthProvider(
      mockCacheService,
      mockConfigService,
      mockIdentityService,
    );

    mockConfigService.get.mockResolvedValue({
      value: {
        clients: [mockClient],
      },
      version: 1,
    });
  });

  describe("getClient", () => {
    it("should return client when found", async () => {
      const client = await oauthProvider.getClient("test-client");
      expect(client).toEqual(mockClient);
      expect(mockConfigService.get).toHaveBeenCalledTimes(1);
    });

    it("should return undefined when client not found", async () => {
      const client = await oauthProvider.getClient("non-existent-client");
      expect(client).toBeUndefined();
    });
  });

  describe("validateClient", () => {
    it("should return true for valid client and redirect URI", async () => {
      const result = await oauthProvider.validateClient(
        "test-client",
        "http://yourapp/oauth/callback",
      );
      expect(result).toBe(true);
    });

    it("should return false for invalid client", async () => {
      mockConfigService.get.mockResolvedValue({
        value: {
          clients: [],
        },
        version: 0,
      });

      const result = await oauthProvider.validateClient(
        "invalid-client",
        "http://yourapp/oauth/callback",
      );
      expect(result).toBe(false);
    });

    it("should return false for invalid redirect URI", async () => {
      const result = await oauthProvider.validateClient(
        "test-client",
        "http://yourapp/invalid/redir",
      );
      expect(result).toBe(false);
    });
  });

  describe("generateAuthorizationCode", () => {
    it("should generate code and store in cache", () => {
      mockCacheService.put.mockReturnValue(undefined);

      const code = oauthProvider.generateAuthorizationCode(
        1,
        "test-client",
        "read",
      );

      expect(code).toBe("test-code");
      expect(mockCacheService.put).toHaveBeenCalledWith(
        "plugin:authz_server",
        "code:test-code",
        {
          userId: 1,
          clientId: "test-client",
          scope: "read",
        },
        300,
      );
    });
  });

  describe("validateTokenRequest", () => {
    it("should return true for valid request", async () => {
      mockCacheService.get.mockResolvedValue({
        userId: 1,
        clientId: "test-client",
        scope: "read",
      });

      const result = await oauthProvider.validateTokenRequest(
        "test-client",
        "test-secret",
        "test-code",
        "http://yourapp/oauth/callback",
      );

      expect(result).toBe(true);
    });

    it("should return false for invalid client", async () => {
      mockConfigService.get.mockResolvedValue({
        value: {
          clients: [],
        },
        version: 0,
      });

      const result = await oauthProvider.validateTokenRequest(
        "invalid-client",
        "test-secret",
        "test-code",
        "http://yourapp/oauth/callback",
      );

      expect(result).toBe(false);
    });

    it("should return false for invalid client secret", async () => {
      const result = await oauthProvider.validateTokenRequest(
        "test-client",
        "wrong-secret",
        "test-code",
        "http://yourapp/oauth/callback",
      );

      expect(result).toBe(false);
    });

    it("should return false for invalid code", async () => {
      mockCacheService.get.mockResolvedValue(null);

      const result = await oauthProvider.validateTokenRequest(
        "test-client",
        "test-secret",
        "invalid-code",
        "http://yourapp/oauth/callback",
      );

      expect(result).toBe(false);
    });
  });

  describe("exchangeAuthorizationCodeForToken", () => {
    it("should exchange valid code for token", async () => {
      const mockContext = {
        userId: 1,
        clientId: "test-client",
        scope: "read",
      };
      const mockToken = "generated-token";

      mockCacheService.get.mockResolvedValue(mockContext);
      mockCacheService.del.mockResolvedValue(undefined);
      mockIdentityService.generateToken.mockReturnValue(mockToken);

      const token =
        await oauthProvider.exchangeAuthorizationCodeForToken("test-code");

      expect(token).toBe(mockToken);
      expect(mockCacheService.del).toHaveBeenCalledWith(
        "plugin:authz_server",
        "code:test-code",
      );
      expect(mockIdentityService.generateToken).toHaveBeenCalledWith({
        aud: "scoped",
        jti: "test-code",
        sub: 1,
        scopes: ["read"],
      });
    });

    it("should return undefined for invalid code", async () => {
      mockCacheService.get.mockResolvedValue(null);

      const token =
        await oauthProvider.exchangeAuthorizationCodeForToken("invalid-code");

      expect(token).toBeUndefined();
      expect(mockCacheService.del).not.toHaveBeenCalled();
      expect(mockIdentityService.generateToken).not.toHaveBeenCalled();
    });
  });
});
