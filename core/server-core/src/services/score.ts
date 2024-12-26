import {
  ChallengeMetadata,
  ChallengePrivateMetadataBase,
  Score,
  ScoringStrategy,
} from "@noctf/api/datatypes";
import { ServiceCradle } from "../index.ts";
import { ScoreConfig, SetupConfig } from "@noctf/api/config";
import { SolveDAO } from "../dao/solve.ts";
import { Parser, Expression } from "expr-eval";
import { LocalCache } from "../util/local_cache.ts";
import { partition } from "../util/object.ts";

type Props = Pick<
  ServiceCradle,
  | "cacheService"
  | "challengeService"
  | "configService"
  | "databaseClient"
  | "logger"
>;

type ScoreContext = {
  n: number;
  t0: number;
  t: number;
};

export type ChallengeSolvesResult = {
  score: number;
  solves: Score[];
};

const CACHE_NAMESPACE = "core:svc:score";

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
  private readonly cacheService;
  private readonly challengeService;
  private readonly configService;
  private readonly databaseClient;
  private readonly logger;

  private readonly solveDAO = new SolveDAO();
  private readonly exprCache = new LocalCache<string, Expression>({
    max: 1000,
    ttl: 3600 * 1000,
  });

  constructor({
    cacheService,
    challengeService,
    configService,
    databaseClient,
    logger,
  }: Props) {
    this.cacheService = cacheService;
    this.challengeService = challengeService;
    this.configService = configService;
    this.databaseClient = databaseClient;
    this.logger = logger;
    void this.init();
  }

  async init() {
    await this.configService.register(ScoreConfig, { strategies: {} });
  }

  async getChallengeSolves(
    c: number | ChallengeMetadata,
  ): Promise<ChallengeSolvesResult> {
    if (typeof c === "number") {
      return this.cacheService.load(CACHE_NAMESPACE, `c:${c}`, async () => {
        const challenge = await this.challengeService.getMetadata(c);
        return this.computeScoresForChallenge(challenge);
      });
    }
    return this.cacheService.load(CACHE_NAMESPACE, `c:${c.id}`, async () => {
      return this.computeScoresForChallenge(c);
    });
  }

  private async computeScoresForChallenge(
    challenge: ChallengeMetadata,
  ): Promise<ChallengeSolvesResult> {
    const {
      score: { strategy, params, bonus },
    } = challenge.private_metadata as ChallengePrivateMetadataBase;
    const solves = await this.solveDAO.getSolvesForChallenge(
      this.databaseClient.get(),
      challenge.id,
    );
    const [valid, hidden] = partition(
      solves,
      ({ team_flags, hidden }) => !(team_flags.includes("hidden") || hidden),
    );
    const base = await this.evaluateScore(strategy, params, valid.length);
    const rv: Score[] = valid.map(({ team_id, created_at }, i) => ({
      team_id,
      bonus: bonus && i + 1,
      hidden: false,
      score: base + ((bonus && Math.round(bonus[i])) || 0),
      created_at,
    }));
    const rh: Score[] = hidden.map(({ team_id, created_at }) => ({
      team_id,
      hidden: true,
      score: base,
      created_at,
    }));
    return {
      score: base,
      solves: rv.concat(rh),
    };
  }

  async computeScoreboard() {
    const challenges = await this.challengeService.list({
      hidden: false,
      visible_at: new Date(),
    });
    // score, followed by date of last solve for tiebreak purposes
    const teamScores: Map<number, [number, number]> = new Map();

    const computed = await Promise.all(
      challenges.map((x) =>
        this.getChallengeSolves(x).then(
          ({ solves }) => [x.id, solves] as [number, Score[]],
        ),
      ),
    );
    // TODO: Could parallelise this loop maybe
    for (const [_id, solves] of computed) {
      for (const solve of solves) {
        if (solve.hidden) continue;
        let team = teamScores.get(solve.team_id);
        if (!team) {
          team = [0, 0];
          teamScores.set(solve.team_id, team);
        }
        // using side effects
        team[0] += solve.score;
        team[1] = Math.max(team[1], solve.created_at.getTime());
      }
    }
    return teamScores;
  }

  async evaluateScore(
    strategyName: string,
    params: Record<string, number>,
    n: number,
  ) {
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
    try {
      const expr = await this.exprCache.load(strategy.expr, () =>
        parser.parse(strategy.expr),
      );
      return Math.round(
        expr.evaluate({
          ...params,
          ctx,
        }),
      );
    } catch (e) {
      this.logger.error(
        { stack: e.stack, name: strategyName, source: strategy.source },
        `Failed to evaluate scoring expression`,
      );
      return null;
    }
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
}
