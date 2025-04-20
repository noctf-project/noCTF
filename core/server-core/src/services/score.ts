import { ScoreConfig } from "@noctf/api/config";
import { LocalCache } from "../util/local_cache.ts";
import type { Expression } from "expr-eval";
import { Parser } from "expr-eval";
import type { ServiceCradle } from "../index.ts";
import type { ScoringStrategy } from "@noctf/api/datatypes";

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
      " maximum score, and decay is the number of solves before the score becomes zero.",
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

export function EvaluateScoringExpression(
  expr: Expression,
  params: Record<string, number>,
  n: number,
): number;
export function EvaluateScoringExpression(
  expr: Expression,
  params: Record<string, number>,
  n: number,
  all: true,
): [number, number][];
export function EvaluateScoringExpression(
  expr: Expression,
  params: Record<string, number>,
  n: number,
  all?: boolean,
): number | [number, number][] {
  if (!all) {
    return Math.round(
      expr.evaluate({
        ...params,
        ctx: { n },
      }),
    );
  }
  const results: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const result = Math.round(
      expr.evaluate({
        ...params,
        ctx: { n: i },
      }),
    );
    if (!results.length || results[results.length - 1][1] !== result) {
      results.push([1, result]);
    } else {
      results[results.length - 1][0]++;
    }
  }
  return results;
}

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
    await this.configService.register(ScoreConfig, { strategies: {} });
  }

  async getStrategies() {
    const {
      value: { strategies: cfgStrategies },
    } = await this.configService.get<ScoreConfig>(ScoreConfig.$id!);
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
          ...STRATEGIES[k],
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
