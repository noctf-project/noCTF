import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mockDeep, DeepMockProxy } from "vitest-mock-extended";
import { ScoreService } from "./score.ts";
import { ConfigService } from "./config.ts";
import { ScoreConfig } from "@noctf/api/config";
import { ValidationError } from "../errors.ts";
import { Logger } from "../types/primitives.ts";

describe(ScoreService, () => {
  let configService: DeepMockProxy<ConfigService>;
  let logger: DeepMockProxy<Logger>;
  let service: ScoreService;

  beforeEach(() => {
    configService = mockDeep<ConfigService>();
    logger = mockDeep<Logger>();
    service = new ScoreService({ configService, logger });
  });

  afterEach(() => {
    service = null as unknown as ScoreService;
  });

  describe("init & validation callback", () => {
    it("registers ScoreConfig with custom validator", async () => {
      expect(configService.register).toHaveBeenCalledWith(
        ScoreConfig,
        { strategies: {} },
        expect.any(Function),
      );
    });

    it("validator accepts valid strategy with valid ctx variables", async () => {
      const validator = configService.register.mock.calls[0][2]!;

      expect(() =>
        validator({
          strategies: {
            custom: {
              expr: "ctx.n * 10 + ctx.w",
              description: "test",
            },
          },
        }),
      ).not.toThrow();
    });

    it("validator rejects strategy with unknown ctx variables", async () => {
      const validator = configService.register.mock.calls[0][2]!;

      expect(() =>
        validator({
          strategies: {
            custom: {
              expr: "ctx.foo + 1",
              description: "bad context",
            },
          },
        }),
      ).toThrow(ValidationError);
    });

    it("validator rejects strategy with syntax errors", async () => {
      const validator = configService.register.mock.calls[0][2]!;

      expect(() =>
        validator({
          strategies: {
            custom: {
              expr: "((+++",
              description: "invalid",
            },
          },
        }),
      ).toThrow(ValidationError);
    });
  });

  describe("getStrategies & getExpr", () => {
    it("returns merged core strategies and config strategies", async () => {
      configService.get.mockResolvedValue({
        version: 1,
        value: {
          strategies: {
            custom_dynamic: {
              expr: "100 / ctx.n",
              description: "Custom dynamic",
            },
          },
        },
      });

      const strategies = await service.getStrategies();

      expect(strategies["core:static"]).toBeDefined();
      expect(strategies["core:quadratic"]).toBeDefined();
      expect(strategies["config:custom_dynamic"]).toBeDefined();
      expect(strategies["config:custom_dynamic"].source).toBe("config");
    });

    it("compiles and caches expression on getExpr", async () => {
      configService.get.mockResolvedValue({
        version: 1,
        value: {
          strategies: {},
        },
      });

      const expr = await service.getExpr("core:static");
      expect(expr).toBeDefined();
      expect(expr.evaluate({ base: 50 })).toBe(50);
    });

    it("throws error if strategy does not exist", async () => {
      configService.get.mockResolvedValue({
        version: 1,
        value: { strategies: {} },
      });

      await expect(service.getExpr("non_existent")).rejects.toThrow(
        "Scoring strategy non_existent does not exist",
      );
    });
  });
});
