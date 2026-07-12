import { ScoreConfig } from "@noctf/api/config";
import { LocalCache } from "../util/local_cache.ts";
import type { Expression } from "expr-eval";
import { Parser } from "expr-eval";
import type { ServiceCradle } from "../index.ts";
import type { ScoringStrategy } from "@noctf/api/datatypes";
import { ApplicationError, ValidationError } from "../errors.ts";

type Props = Pick<ServiceCradle, "configService" | "logger">;

const STRATEGIES: Record<string, ScoringStrategy> = {
  static: {
    expr: "base",
    description: "Returns a static score. Takes in a singular [base] param.",
  },
  quadratic: {
    expr: "max(minimum, ceil((((minimum - initial) / (decay ^ 2)) * (max(0, ctx.n-1) ^ 2)) + initial))",
    description:
      "Based on CTFd's dynamic scoring formula. initial is the maximum score, " +
      "and decay is the number of solves before the score becomes zero.",
  },
  exponential: {
    expr: "minimum + (initial - minimum) / (1 + (max(0, ctx.n - 1)/k) ^ j)",
    description:
      "Based on the CCC CTF dynamic scoring formula. initial is" +
      " the maximum score, k is the scaling factor and j is the exponent.",
  },
  bounded_weight: {
    expr: "max(lower, min(upper, ctx.w))",
    description:
      "A simple formula to clamp an externally provided weight between" +
      " a lower and upper bound.",
  },
};

const parser = new Parser({
  operators: {
    assignment: false,
    concatenate: false,
    fndef: false,
    factorial: false, // DoS vector
    in: false,
  },
});

const VALID_CTX = new Set(["n", "w"]);

export class ScoreService {
  private readonly configService;

  private readonly exprCache = new LocalCache<string, Expression>({
    max: 1000,
    ttl: Infinity,
  });

  constructor({ configService }: Props) {
    this.configService = configService;
    void this.init();
  }

  async init() {
    await this.configService.register(ScoreConfig, { strategies: {} }, (v) => {
      for (const strategy of Object.keys(v.strategies)) {
        try {
          const expr = parser.parse(v.strategies[strategy]!.expr);
          const vars = new Set(
            expr
              .variables({ withMembers: true })
              .filter((v) => v.startsWith("ctx."))
              .map((v) => v.substring(4)),
          );
          if (!vars.isSubsetOf(VALID_CTX)) {
            throw new ValidationError(
              `Scoring strategy ${strategy} has unknown context variables`,
            );
          }
        } catch (e) {
          if (e instanceof ApplicationError) throw e;
          throw new ValidationError(
            `Scoring strategy ${strategy} failed to parse`,
          );
        }
      }
    });
  }

  async getStrategies() {
    const {
      value: { strategies: cfgStrategies },
    } = await this.configService.get(ScoreConfig);
    const strategies: Record<string, ScoringStrategy> = {};
    Object.keys(STRATEGIES).map(
      (k) =>
        (strategies[`core:${k}`] = {
          ...STRATEGIES[k],
          source: "core",
        }),
    );
    Object.keys(cfgStrategies).map(
      (k) =>
        (strategies[`config:${k}`] = {
          ...cfgStrategies[k],
          source: "config",
        }),
    );
    return strategies;
  }

  async getExpr(strategyName: string) {
    const strategies = await this.getStrategies();
    if (!strategies[strategyName]) {
      throw new Error(`Scoring strategy ${strategyName} does not exist`);
    }
    const strategy = strategies[strategyName];
    return await this.exprCache.load(strategy.expr, () =>
      parser.parse(strategy.expr),
    );
  }
}
