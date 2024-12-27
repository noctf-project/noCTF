import { ScoreConfig, SetupConfig } from "@noctf/api/config";
import { LocalCache } from "../util/local_cache.ts";
import { Expression, Parser } from "expr-eval";
import { ServiceCradle } from "../index.ts";
import { ScoringStrategy } from "@noctf/api/datatypes";

type ScoreContext = {
  n: number;
  t0: number;
  t: number;
};

type Props = Pick<ServiceCradle, "configService" | "logger">;

const STRATEGIES: Record<string, ScoringStrategy> = {
  static: {
    expr: "base",
    description: "Returns a static score. Takes in a singular [base] param.",
  },
  quadratic: {
    expr: "max(base, (((base - top) / (decay ^ 2)) * (ctx.n ^ 2)) + top)",
    description:
      "Based on CTFd's dynamic scoring formula. base is the minimum score, top is the" +
      "maximum score, and decay is the number of solves before the score becomes zero.",
  },
  exponential: {
    expr: "base + (top - base) / (1 + (max(0, ctx.n - 1)/k) ^ j)",
    description:
      "Based on the CCC CTF dynamic scoring formula. base is the minimum score, top is" +
      " the maximum score, k is the scaling factor and j is the exponent.",
  },
};

const parser = new Parser({
  operators: {
    assignment: false,
    concatenate: false,
    fndef: false,
  },
});

export class ScoreService {
  private readonly configService;
  private readonly logger;

  private readonly exprCache = new LocalCache<string, Expression>({
    max: 1000,
    ttl: 3600 * 1000,
  });

  constructor({ configService, logger }: Props) {
    this.configService = configService;
    this.logger = logger;
    void this.init();
  }

  async init() {
    await this.configService.register(ScoreConfig, { strategies: {} });
  }

  async getStrategies() {
    const {
      value: { strategies: cfgStrategies },
    } = await this.configService.get<ScoreConfig>(ScoreConfig.$id);
    const strategies: Record<string, ScoringStrategy> = {};
    Object.keys(STRATEGIES).map(
      (k) =>
        (strategies[k] = {
          ...STRATEGIES[k],
          source: "core",
        }),
    );
    Object.keys(cfgStrategies).map(
      (k) =>
        (strategies[k] = {
          ...STRATEGIES[k],
          source: "config",
        }),
    );
    return strategies;
  }

  async evaluate(
    strategyName: string,
    params: Record<string, number>,
    n: number,
  ): Promise<number> {
    const {
      value: { start_time_s, end_time_s },
    } = await this.configService.get<SetupConfig>(SetupConfig.$id);
    const ctx: ScoreContext = {
      n,
      t0: start_time_s || 0,
      t: Math.min(
        end_time_s ? end_time_s - start_time_s : Number.MAX_SAFE_INTEGER,
        Math.floor(Date.now() / 1000) - start_time_s,
      ),
    };
    const strategies = await this.getStrategies();
    if (!strategies[strategyName]) {
      return null;
    }
    const strategy = strategies[strategyName];
    const expr = await this.exprCache.load(strategy.expr, () =>
      parser.parse(strategy.expr),
    );
    return Math.round(
      expr.evaluate({
        ...params,
        ctx,
      }),
    );
  }
}
