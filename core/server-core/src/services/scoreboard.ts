import type {
  ChallengeMetadata,
  ChallengePrivateMetadataBase,
  Score,
} from "@noctf/api/datatypes";
import type { ServiceCradle } from "../index.ts";
import { SolveDAO } from "../dao/solve.ts";
import { partition } from "../util/object.ts";
import pLimit from "p-limit";

type Props = Pick<
  ServiceCradle,
  | "cacheService"
  | "challengeService"
  | "scoreService"
  | "databaseClient"
  | "logger"
>;

export type ChallengeSolvesResult = {
  score: number | null;
  solves: Score[];
};

const CACHE_NAMESPACE = "core:svc:score";
const PARALLEL_CHALLENGE_LIMIT = 16;
const PARALLEL_CHALLENGE_LIMITER = pLimit(PARALLEL_CHALLENGE_LIMIT);

export class ScoreboardService {
  private readonly logger;
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
    logger,
  }: Props) {
    this.logger = logger;
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
    } catch (err) {
      this.logger.warn(
        {
          err,
          challenge_id: challenge.id,
        },
        "Failed to calculate scores for challenge",
      );
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
        PARALLEL_CHALLENGE_LIMITER(() => this.getChallengeSolves(x)).then(
          ({ solves }) => [x.id, solves] as [number, Score[]],
        ),
      ),
    );
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
