import type { ScoreboardEntry } from "@noctf/api/datatypes";
import type { ServiceCradle } from "../../index.ts";
import { DBSolve, SolveDAO } from "../../dao/solve.ts";
import { DivisionDAO } from "../../dao/division.ts";
import {
  ChallengeMetadataWithExpr,
  ChallengeScore,
  ComputeScoreboardByDivision,
  GetChangedTeamScores,
} from "./calc.ts";
import { ScoreHistoryDAO } from "../../dao/score_history.ts";
import { SetupConfig } from "@noctf/api/config";

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

export const CACHE_SCORE_NAMESPACE = "core:svc:score";
export const CACHE_SCORE_HISTORY_NAMESPACE = "core:svc:score_history";

export class ScoreboardService {
  private readonly logger;
  private readonly cacheService;
  private readonly challengeService;
  private readonly configService;
  private readonly scoreService;

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

    this.scoreHistoryDAO = new ScoreHistoryDAO(databaseClient.get());
    this.solveDAO = new SolveDAO(databaseClient.get());
    this.divisionDAO = new DivisionDAO(databaseClient.get());
  }

  async getScoreboard(division_id: number) {
    const scoreboard = await this.cacheService.get<
      UpdatedContainer<ScoreboardEntry[]>
    >(CACHE_SCORE_NAMESPACE, `s:scoreboard:${division_id}`);
    if (!scoreboard) {
      return null;
    }
    return scoreboard;
  }

  async getSolves(
    division_id?: number,
    params?: Parameters<SolveDAO["getAllSolves"]>[1],
  ) {
    return await this.solveDAO.getAllSolves(division_id, params);
  }

  async getChallengeScores(division_id: number) {
    const scoreboard = await this.cacheService.get<
      UpdatedContainer<Record<number, ChallengeScore>>
    >(CACHE_SCORE_NAMESPACE, `s:challenges:${division_id}`);
    if (!scoreboard) {
      return { data: [], updated_at: new Date(0) };
    }
    return scoreboard;
  }

  async computeAndSaveScoreboards() {
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
          ({ timestamp, score }) =>
            [timestamp.getTime(), score] as [number, number],
        );
      },
    );
  }

  private async clearTeamScoreHistory(id: number) {
    return await this.scoreHistoryDAO.flushTeam(id);
  }

  private async commitDivisionScoreboard(
    challenges: ChallengeMetadataWithExpr[],
    id: number,
  ) {
    const solveList = await this.getSolves(id);
    const solvesByChallenge = Object.groupBy(
      solveList || [],
      ({ challenge_id }) => challenge_id,
    ) as Record<number, DBSolve[]>;

    const { scoreboard, challenges: challengeScores } =
      ComputeScoreboardByDivision(challenges, solvesByChallenge, this.logger);
    const { data: lastScoreboard } = (await this.getScoreboard(id)) || {};
    const updated_at = new Date();
    await this.cacheService.put<UpdatedContainer<ScoreboardEntry[]>>(
      CACHE_SCORE_NAMESPACE,
      `s:scoreboard:${id}`,
      {
        data: scoreboard,
        updated_at,
      },
    );
    await this.cacheService.put<
      UpdatedContainer<Record<number, ChallengeScore>>
    >(CACHE_SCORE_NAMESPACE, `s:challenges:${id}`, {
      data: challengeScores,
      updated_at,
    });

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
  }
}
