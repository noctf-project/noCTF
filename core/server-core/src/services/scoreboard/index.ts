import type { ScoreboardEntry, Solve } from "@noctf/api/datatypes";
import type { ServiceCradle } from "../../index.ts";
import { DBSolve, SolveDAO } from "../../dao/solve.ts";
import { DivisionDAO } from "../../dao/division.ts";
import {
  ChallengeMetadataWithExpr,
  ChallengeSummary,
  ComputeScoreboard,
  GetChangedTeamScores,
} from "./calc.ts";
import { ScoreHistoryDAO } from "../../dao/score_history.ts";
import { SetupConfig } from "@noctf/api/config";
import { AwardDAO } from "../../dao/award.ts";
import { Coleascer } from "../../util/coleascer.ts";

type Props = Pick<
  ServiceCradle,
  | "cacheService"
  | "configService"
  | "challengeService"
  | "scoreService"
  | "databaseClient"
  | "logger"
>;

type UpdatedContainer<T> = {
  data: T;
  updated_at: Date;
};

export const CACHE_SCORE_HISTORY_NAMESPACE = "core:svc:score_history";
const CACHE_SCORE_NAMESPACE = "core:svc:score";

export class ScoreboardService {
  private readonly logger;
  private readonly cacheService;
  private readonly challengeService;
  private readonly configService;
  private readonly scoreService;

  private readonly awardDAO;
  private readonly scoreHistoryDAO;
  private readonly solveDAO;
  private readonly divisionDAO;

  constructor({
    cacheService,
    configService,
    challengeService,
    databaseClient,
    scoreService,
    logger,
  }: Props) {
    this.logger = logger;
    this.cacheService = cacheService;
    this.challengeService = challengeService;
    this.configService = configService;
    this.scoreService = scoreService;

    this.awardDAO = new AwardDAO(databaseClient.get());
    this.scoreHistoryDAO = new ScoreHistoryDAO(databaseClient.get());
    this.solveDAO = new SolveDAO(databaseClient.get());
    this.divisionDAO = new DivisionDAO(databaseClient.get());
  }

  async getScoreboard(division_id: number) {
    const scoreboard = await this.cacheService.get<
      UpdatedContainer<ScoreboardEntry[]>
    >(CACHE_SCORE_NAMESPACE, `d:${division_id}:scoreboard`);
    if (!scoreboard) {
      return { data: [], updated_at: new Date(0) };
    }
    return scoreboard;
  }

  async getTeamSolves(team_id: number) {
    const end_time = (
      await this.configService.get<SetupConfig>(SetupConfig.$id!)
    ).value?.end_time_s;
    return this.solveDAO.getTeamSolves(team_id, {
      hidden: false,
      end_time:
        typeof end_time === "number" ? new Date(end_time * 1000) : undefined,
    });
  }

  async getTeamAwards(team_id: number) {
    const end_time = (
      await this.configService.get<SetupConfig>(SetupConfig.$id!)
    ).value?.end_time_s;
    return this.awardDAO.getTeamAwards(team_id, {
      end_time:
        typeof end_time === "number" ? new Date(end_time * 1000) : undefined,
    });
  }

  async getChallengesSummary(division_id: number) {
    const scoreboard = await this.cacheService.get<
      UpdatedContainer<Record<number, ChallengeSummary>>
    >(CACHE_SCORE_NAMESPACE, `d:${division_id}:challenges_summary`);
    if (!scoreboard) {
      return { data: {}, updated_at: new Date(0) };
    }
    return scoreboard;
  }

  async getChallengeSolves(division_id: number, challenge_id: number) {
    const scoreboard = await this.cacheService.get<UpdatedContainer<Solve[]>>(
      CACHE_SCORE_NAMESPACE,
      `d:${division_id}:challenge_solves:${challenge_id}`,
    );
    if (!scoreboard) {
      return { data: [], updated_at: new Date(0) };
    }
    return scoreboard;
  }

  async computeAndSaveScoreboards() {
    this.logger.info("Computing scoreboards");
    const challenges: ChallengeMetadataWithExpr[] = await Promise.all(
      (
        await this.challengeService.list({
          hidden: false,
          visible_at: new Date(),
        })
      ).map(async (metadata) => ({
        expr: await this.scoreService.getExpr(
          metadata.private_metadata.score.strategy,
        ),
        metadata,
      })),
    );
    const divisions = await this.divisionDAO.listDivisions();
    for (const { id } of divisions) {
      await this.commitDivisionScoreboard(challenges, id);
    }
  }

  async getTeamScoreHistory(id: number) {
    return this.cacheService.load(
      CACHE_SCORE_HISTORY_NAMESPACE,
      id.toString(),
      async () => {
        const {
          value: { start_time_s, end_time_s },
        } = await this.configService.get<SetupConfig>(SetupConfig.$id!);
        return (
          await this.scoreHistoryDAO.getByTeam(
            id,
            start_time_s ? new Date(start_time_s * 1000) : undefined,
            end_time_s ? new Date(end_time_s * 1000) : undefined,
          )
        ).map(
          ({ updated_at, score }) =>
            [updated_at.getTime(), score] as [number, number],
        );
      },
    );
  }

  private async commitDivisionScoreboard(
    challenges: ChallengeMetadataWithExpr[],
    id: number,
  ) {
    const [solveList, awardList] = await Promise.all([
      this.solveDAO.getAllSolves(id),
      this.awardDAO.getAllAwards(id),
    ]);
    const solvesByChallenge = Object.groupBy(
      solveList || [],
      ({ challenge_id }) => challenge_id,
    ) as Record<number, DBSolve[]>;

    const { scoreboard, challenges: challengeScores } = ComputeScoreboard(
      challenges,
      solvesByChallenge,
      awardList,
      this.logger,
    );
    const updated_at = new Date();
    await this.cacheService.put<UpdatedContainer<ScoreboardEntry[]>>(
      CACHE_SCORE_NAMESPACE,
      `d:${id}:scoreboard`,
      {
        data: scoreboard,
        updated_at,
      },
    );
    const compacted: Record<number, ChallengeSummary> = {};
    for (const { challenge_id, score, solves } of Object.values(
      challengeScores,
    )) {
      compacted[challenge_id] = {
        challenge_id,
        score,
        solve_count: solves.filter(({ hidden }) => !hidden).length,
        bonuses: solves.map(({ bonus }) => bonus).filter((x) => x) as number[], // assuming solves are ordered
      };
    }
    await this.cacheService.put<
      UpdatedContainer<Record<number, ChallengeSummary>>
    >(CACHE_SCORE_NAMESPACE, `d:${id}:challenges_summary`, {
      data: compacted,
      updated_at,
    });
    await Promise.all(
      Object.values(challengeScores).map(({ challenge_id, solves }) =>
        this.cacheService.put<UpdatedContainer<Solve[]>>(
          CACHE_SCORE_NAMESPACE,
          `d:${id}:challenge_solves:${challenge_id}`,
          {
            data: solves,
            updated_at,
          },
        ),
      ),
    );

    // we want a separate cache value for graphing in case the calculation crashed
    // halfway through
    const { data: lastScoreboard } =
      (await this.cacheService.get<UpdatedContainer<ScoreboardEntry[]>>(
        CACHE_SCORE_NAMESPACE,
        `d:${id}:calc_graph`,
      )) || {};

    let diff = scoreboard;
    if (lastScoreboard) {
      diff = GetChangedTeamScores(lastScoreboard, scoreboard);
    }
    await this.scoreHistoryDAO.add(diff);
    const teams = new Set(diff.map(({ team_id }) => team_id));
    await Promise.all(
      teams
        .values()
        .map((t) =>
          this.cacheService.del(CACHE_SCORE_HISTORY_NAMESPACE, t.toString()),
        ),
    );

    await this.cacheService.put<UpdatedContainer<ScoreboardEntry[]>>(
      CACHE_SCORE_NAMESPACE,
      `d:${id}:calc_graph`,
      {
        data: scoreboard,
        updated_at,
      },
    );
  }
}
