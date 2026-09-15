import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mock, mockDeep, DeepMockProxy } from "vitest-mock-extended";
import { CaptchaConfig } from "@noctf/api/config";
import { ConfigService } from "./config.ts";
import { ValidationError } from "../errors.ts";
import {
  BaseSiteVerifyCaptchaProvider,
  CaptchaProvider,
  CaptchaService,
} from "./captcha.ts";
import type { KyResponse } from "ky";
import ky from "ky";

vi.mock("ky");
const mockKy = vi.mocked(ky, true);

class StubCaptchaProvider extends BaseSiteVerifyCaptchaProvider {
  constructor() {
    super("stub", "https://example.com/siteverify");
  }
}

class DummyCaptchaProvider implements CaptchaProvider {
  constructor(
    private readonly _id = "dummy",
    private readonly result = Date.now(),
  ) {}

  id() {
    return this._id;
  }

  async validate(): Promise<number> {
    return this.result;
  }
}

describe(CaptchaService, () => {
  let configService: DeepMockProxy<ConfigService>;
  let service: CaptchaService;

  beforeEach(() => {
    configService = mockDeep<ConfigService>();
    service = new CaptchaService({ configService });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetAllMocks();
  });

  describe("constructor", () => {
    it("registers the captcha config with a validator", () => {
      expect(configService.register).toHaveBeenCalledWith(
        CaptchaConfig,
        { routes: [] },
        expect.any(Function),
      );
    });

    it("rejects a config referencing an unregistered provider", () => {
      const validator = configService.register.mock.calls[0][2] as (
        v: unknown,
      ) => void;
      expect(() => validator({ provider: "doesnotexist", routes: [] })).toThrow(
        "Captcha provider doesnotexist does not exist",
      );
    });

    it("accepts a config with no provider or a registered provider", () => {
      const validator = configService.register.mock.calls[0][2] as (
        v: unknown,
      ) => void;
      expect(() => validator({ routes: [] })).not.toThrow();
      service.register(new DummyCaptchaProvider("hcaptcha"));
      expect(() =>
        validator({ provider: "hcaptcha", routes: [] }),
      ).not.toThrow();
    });
  });

  describe("register", () => {
    it("throws when a provider has already been registered", () => {
      const provider = new DummyCaptchaProvider();
      service.register(provider);
      expect(() => service.register(provider)).toThrow(
        "Provider dummy has already been registered",
      );
    });
  });

  describe("getConfig", () => {
    it("returns the config from the config service", async () => {
      const value = { provider: "stub", private_key: "key", routes: [] };
      configService.get.mockResolvedValue({ version: 1, value });
      expect(await service.getConfig()).toBe(value);
    });
  });

  describe("validate", () => {
    it("passes validation when no provider is configured", async () => {
      configService.get.mockResolvedValue({
        version: 1,
        value: { routes: [] },
      });
      expect(await service.validate("response", "1.2.3.4")).toBeGreaterThan(0);
    });

    it("throws when the configured provider is not registered", async () => {
      configService.get.mockResolvedValue({
        version: 1,
        value: { provider: "stub", private_key: "key", routes: [] },
      });
      await expect(service.validate("response", "1.2.3.4")).rejects.toThrow(
        "Captcha provider stub is not configured",
      );
    });

    it("throws when the private key is missing", async () => {
      service.register(new DummyCaptchaProvider("stub"));
      configService.get.mockResolvedValue({
        version: 1,
        value: { provider: "stub", routes: [] },
      });
      await expect(service.validate("response", "1.2.3.4")).rejects.toThrow(
        "Captcha provider stub is not configured",
      );
    });

    it("delegates validation to the configured provider", async () => {
      const provider = new DummyCaptchaProvider("stub", 123_456_789);
      service.register(provider);
      configService.get.mockResolvedValue({
        version: 1,
        value: { provider: "stub", private_key: "key", routes: [] },
      });
      expect(await service.validate("response", "1.2.3.4")).toBe(123_456_789);
    });
  });
});

describe(BaseSiteVerifyCaptchaProvider, () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("returns the provider id", () => {
    expect(new StubCaptchaProvider().id()).toBe("stub");
  });

  it("posts the verification data and returns the challenge timestamp on success", async () => {
    const response =
      mock<KyResponse<{ success: boolean; challenge_ts?: string }>>();
    response.json.mockResolvedValue({
      success: true,
      challenge_ts: "2020-05-01T00:00:00.000Z",
    });
    mockKy.post.mockResolvedValueOnce(response);

    const result = await new StubCaptchaProvider().validate(
      "secret",
      "captcha-response",
      "1.2.3.4",
    );

    expect(mockKy.post).toHaveBeenCalledWith("https://example.com/siteverify", {
      body: new URLSearchParams({
        response: "captcha-response",
        remoteip: "1.2.3.4",
        secret: "secret",
      }),
    });
    expect(result).toBe(new Date("2020-05-01T00:00:00.000Z").valueOf());
  });

  it("throws a ValidationError when the challenge fails", async () => {
    const response =
      mock<KyResponse<{ success: boolean; challenge_ts?: string }>>();
    response.json.mockResolvedValue({ success: false });
    mockKy.post.mockResolvedValueOnce(response);

    await expect(
      new StubCaptchaProvider().validate("secret", "response", "1.2.3.4"),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
