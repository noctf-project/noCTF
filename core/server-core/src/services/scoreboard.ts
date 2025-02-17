import type {
  ChallengeMetadata,
  ChallengePrivateMetadataBase,
  Score,
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
  solves: Score[];
};

export const CACHE_SCORE_NAMESPACE = "core:svc:score";
const PARALLEL_CHALLENGE_LIMIT = 16;
const PARALLEL_CHALLENGE_LIMITER = pLimit(PARALLEL_CHALLENGE_LIMIT);

export class ScoreboardService {
  private readonly logger;
  private readonly cacheService;
  private readonly challengeService;
  private readonly databaseClient;
  private readonly scoreService;

  private readonly solveDAO = new SolveDAO();
  private readonly divisionDAO = new DivisionDAO();

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
    solve_base_id?: number,
  ): Promise<ChallengeSolvesResult> {
    const isId = typeof c === "number";
    const cacheKey = isId ? `c:${c}` : `c:${c.id}`;
    return this.cacheService.load(CACHE_SCORE_NAMESPACE, cacheKey, async () => {
      const challenge = isId ? await this.challengeService.getMetadata(c) : c;
      const solves = await this.solveDAO.getSolvesForChallenge(
        this.databaseClient.get(),
        challenge.id,
        solve_base_id,
      );
      return this.computeScoresForChallenge(challenge, solves);
    });
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

  async getScoreboard(hiddenSolves = false) {
    return this.cacheService.load(
      CACHE_SCORE_NAMESPACE,
      `all:${hiddenSolves}`,
      async () => {
        return this.computeScoreboards(hiddenSolves);
      },
    );
  }

  async computeScoreboards(hiddenSolves: boolean) {
    const challenges = await this.challengeService.list({
      hidden: false,
      visible_at: new Date(),
    });
    const solveBases = await this.divisionDAO.getAllTeamSolveBases(
      this.databaseClient.get(),
    );
    const solves = await this.solveDAO.getAllSolves(this.databaseClient.get());
    const solvesByChallenge = Object.groupBy(
      solves,
      ({ challenge_id }) => challenge_id,
    ) as Record<number, DBSolve[]>;
    const teamsBySolveBase = solveBases.reduce(
      (prev, { team_id, solve_base_id }) => {
        if (!prev[solve_base_id]) {
          prev[solve_base_id] = new Set();
        }
        prev[solve_base_id]?.add(team_id);
        return prev;
      },
      {} as Record<number, Set<number>>,
    );

    const bases = [];
    for (const teams of Object.values(teamsBySolveBase)) {
      bases.push(
        await this.computeScoreboardByBase(
          challenges,
          teams,
          solvesByChallenge,
          hiddenSolves,
        ),
      );
    }
    // TODO: save each solve base in a separate redis key
    return bases[0];
  }

  private async computeScoreboardByBase(
    challenges: ChallengeMetadata[],
    teams: Set<number>,
    solvesByChallenge: Record<number, DBSolve[]>,
    hiddenSolves: boolean,
  ) {
    // score, followed by date of last solve for tiebreak purposes
    const teamScores: Map<number, { score: number; time: Date }> = new Map();
    const computed = await Promise.all(
      challenges.map((x) =>
        PARALLEL_CHALLENGE_LIMITER(() =>
          this.computeScoresForChallenge(
            x,
            solvesByChallenge[x.id].filter(({ team_id }) =>
              teams.has(team_id),
            ) || [],
          ),
        ).then(({ solves }) => [x.id, solves] as [number, Score[]]),
      ),
    );
    const allSolves = [];
    for (const [challenge_id, solves] of computed) {
      for (const solve of solves) {
        if (!hiddenSolves && solve.hidden) continue;
        allSolves.push({ ...solve, challenge_id });
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
    }
    const scoreboard = Array.from(
      teamScores.entries().map(([id, teamScore]) => ({
        ...teamScore,
        id,
      })),
    );

    return {
      scoreboard: scoreboard.sort(
        (a, b) => a.score - b.score || a.time.getTime() - b.time.getTime(),
      ),
      solves: allSolves.sort(
        (a, b) => a.created_at.getTime() - b.created_at.getTime(),
      ),
    };
  }
}
