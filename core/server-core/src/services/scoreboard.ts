import type {
  ChallengeMetadata,
  ChallengePrivateMetadataBase,
  ScoreboardEntry,
  Solve,
} from "@noctf/api/datatypes";
import type { ServiceCradle } from "../index.ts";
import { DBSolve, SolveDAO } from "../dao/solve.ts";
import { partition } from "../util/object.ts";
import pLimit from "p-limit";
import { DivisionDAO } from "../dao/division.ts";

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
  solves: Solve[];
};

export type ChallengeScore = {
  challenge_id: number;
  score: number;
  solves: { team_id: number; hidden: boolean; created_at: Date }[];
};

type UpdatedContainer<T> = {
  data: T;
  updated_at: Date;
};

export const CACHE_SCORE_NAMESPACE = "core:svc:score";
const PARALLEL_CHALLENGE_LIMIT = 16;
const PARALLEL_CHALLENGE_LIMITER = pLimit(PARALLEL_CHALLENGE_LIMIT);

export class ScoreboardService {
  private readonly logger;
  private readonly cacheService;
  private readonly challengeService;
  private readonly scoreService;

  private readonly solveDAO;
  private readonly divisionDAO;

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
    this.scoreService = scoreService;

    this.solveDAO = new SolveDAO(databaseClient.get());
    this.divisionDAO = new DivisionDAO(databaseClient.get());
  }

  private async computeScoresForChallenge(
    challenge: ChallengeMetadata,
    solves: DBSolve[],
  ): Promise<ChallengeSolvesResult> {
    const {
      score: { strategy, params, bonus },
    } = challenge.private_metadata as ChallengePrivateMetadataBase;

    const [valid, hidden] = partition(
      solves,
      ({ team_flags, hidden }) => !(team_flags?.includes("hidden") || hidden),
    );
    try {
      const base = await this.scoreService.evaluate(
        strategy,
        params,
        valid.length,
      );

      const rv: Solve[] = valid.map(({ team_id, created_at }, i) => ({
        team_id,
        challenge_id: challenge.id,
        bonus: bonus && i + 1,
        hidden: false,
        score: base + ((bonus && Math.round(bonus[i])) || 0),
        created_at,
      }));
      const rh: Solve[] = hidden.map(({ team_id, created_at }) => ({
        team_id,
        challenge_id: challenge.id,
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

  async getScoreboard(division_id: number) {
    const scoreboard = this.cacheService.get<
      UpdatedContainer<ScoreboardEntry[]>
    >(CACHE_SCORE_NAMESPACE, `s:scoreboard:${division_id}`);
    if (!scoreboard) {
      return null;
    }
    return scoreboard;
  }

  async getDivisionSolves(division_id: number) {
    const scoreboard = this.cacheService.get<UpdatedContainer<Solve[]>>(
      CACHE_SCORE_NAMESPACE,
      `s:solves:${division_id}`,
    );
    if (!scoreboard) {
      return null;
    }
    return scoreboard;
  }

  async getChallengeScores(division_id: number) {
    const scoreboard = this.cacheService.get<
      UpdatedContainer<Record<number, ChallengeScore>>
    >(CACHE_SCORE_NAMESPACE, `s:challenges:${division_id}`);
    if (!scoreboard) {
      return null;
    }
    return scoreboard;
  }

  async computeAndSaveScoreboards() {
    const challenges = await this.challengeService.list({
      hidden: false,
      visible_at: new Date(),
    });
    const divisions = await this.divisionDAO.listDivisions();
    for (const { id } of divisions) {
      const solveList = await this.solveDAO.getAllSolves(id);
      const solvesByChallenge = Object.groupBy(
        solveList || [],
        ({ challenge_id }) => challenge_id,
      ) as Record<number, DBSolve[]>;

      const {
        scoreboard,
        solves,
        challenges: challengeScores,
      } = await this.computeScoreboardByDivision(challenges, solvesByChallenge);
      const updated_at = new Date();
      await this.cacheService.put<UpdatedContainer<ScoreboardEntry[]>>(
        CACHE_SCORE_NAMESPACE,
        `s:scoreboard:${id}`,
        {
          data: scoreboard,
          updated_at,
        },
      );
      await this.cacheService.put<UpdatedContainer<Solve[]>>(
        CACHE_SCORE_NAMESPACE,
        `s:solves:${id}`,
        {
          data: solves,
          updated_at,
        },
      );

      await this.cacheService.put<
        UpdatedContainer<Record<number, ChallengeScore>>
      >(CACHE_SCORE_NAMESPACE, `s:challenges:${id}`, {
        data: challengeScores,
        updated_at,
      });
    }
  }

  private async computeScoreboardByDivision(
    challenges: ChallengeMetadata[],
    solvesByChallenge: Record<number, DBSolve[]>,
  ) {
    // score, followed by date of last solve for tiebreak purposes
    const teamScores: Map<number, { score: number; time: Date }> = new Map();
    const computed = await Promise.all(
      challenges.map((x) =>
        PARALLEL_CHALLENGE_LIMITER(() =>
          this.computeScoresForChallenge(x, solvesByChallenge[x.id] || []),
        ).then(
          ({ score, solves }) =>
            [x.id, score, solves] as [number, number, Solve[]],
        ),
      ),
    );
    const allSolves = [];
    const challengeScores = [];
    for (const [challenge_id, score, solves] of computed) {
      const challengeSolves = [];
      for (const solve of solves) {
        challengeSolves.push({
          team_id: solve.team_id,
          hidden: solve.hidden,
          created_at: solve.created_at,
        });
        if (solve.hidden) continue;
        allSolves.push(solve);

        let team = teamScores.get(solve.team_id);
        if (!team) {
          team = {
            score: 0,
            time: new Date(0),
          };
          teamScores.set(solve.team_id, team);
        }
        // using side effects
        team.score += solve.score;
        team.time = new Date(
          Math.max(team.time.getTime(), solve.created_at.getTime()),
        );
      }
      challengeScores.push({ challenge_id, score, solves: challengeSolves });
    }
    const scoreboard = Array.from(
      teamScores.entries().map(([team_id, teamScore]) => ({
        ...teamScore,
        team_id,
      })),
    );

    const challengeObj = challengeScores.reduce(
      (prev, cur) => {
        prev[cur.challenge_id] = cur;
        return prev;
      },
      {} as Record<number, ChallengeScore>,
    );

    return {
      scoreboard: scoreboard.sort(
        (a, b) => a.score - b.score || a.time.getTime() - b.time.getTime(),
      ),
      solves: allSolves.sort(
        (a, b) => a.created_at.getTime() - b.created_at.getTime(),
      ),
      challenges: challengeObj,
    };
  }
}
