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
  "cacheService" | "challengeService" | "scoreService" | "databaseClient"
>;

export type ChallengeSolvesResult = {
  score: number | null;
  solves: Score[];
};

const CACHE_NAMESPACE = "core:svc:score";

export class ScoreboardService {
  private readonly cacheService;
  private readonly challengeService;
  private readonly databaseClient;
  private readonly scoreService;

  private readonly solveDAO = new SolveDAO();

  constructor({
    cacheService,
    challengeService,
    databaseClient,
    scoreService,
  }: Props) {
    this.cacheService = cacheService;
    this.challengeService = challengeService;
    this.databaseClient = databaseClient;
    this.scoreService = scoreService;
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
    try {
      const base = await this.scoreService.evaluate(
        strategy,
        params,
        valid.length,
      );

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
    } catch (e) {
      return {
        score: null,
        solves: [],
      };
    }
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
}
