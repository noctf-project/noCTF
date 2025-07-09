import type { ScoreboardEntry } from "@noctf/api/datatypes";
import type { ServiceCradle } from "../../index.ts";
import { DivisionDAO } from "../../dao/division.ts";
import {
  ChallengeMetadataWithExpr,
  ComputeFullGraph,
  ComputeScoreboard,
} from "./calc.ts";
import { HistoryDataPoint } from "../../dao/score_history.ts";
import { SetupConfig } from "@noctf/api/config";
import { AwardDAO } from "../../dao/award.ts";
import { ScoreboardDataLoader } from "./loader.ts";
import { MinimalTeamInfo, TeamDAO } from "../../dao/team.ts";
import { RawSolve, SubmissionDAO } from "../../dao/submission.ts";
import { MaxDate } from "../../util/date.ts";
import { ScoreboardHistory } from "./history.ts";
import { bisectLeft, bisectRight } from "../../util/arrays.ts";

type Props = Pick<
  ServiceCradle,
  | "configService"
  | "challengeService"
  | "scoreService"
  | "databaseClient"
  | "redisClientFactory"
  | "logger"
>;

export class ScoreboardService {
  private readonly logger;
  private readonly challengeService;
  private readonly configService;
  private readonly scoreService;

  private readonly history;
  private readonly dataLoader;

  private readonly awardDAO;
  private readonly submissionDAO;
  private readonly teamDAO;
  private readonly divisionDAO;

  constructor({
    configService,
    challengeService,
    databaseClient,
    redisClientFactory,
    scoreService,
    logger,
  }: Props) {
    this.logger = logger;
    this.challengeService = challengeService;
    this.configService = configService;
    this.scoreService = scoreService;

    this.dataLoader = new ScoreboardDataLoader(redisClientFactory);
    this.history = new ScoreboardHistory({
      redisClientFactory,
      databaseClient,
    });

    this.awardDAO = new AwardDAO(databaseClient.get());
    this.submissionDAO = new SubmissionDAO(databaseClient.get());
    this.teamDAO = new TeamDAO(databaseClient.get());
    this.divisionDAO = new DivisionDAO(databaseClient.get());
  }

  async getScoreboard(
    division_id: number,
    start: number,
    end: number,
    tags?: number[],
  ) {
    return this.dataLoader.getScoreboard(0, division_id, start, end, tags);
  }

  async getTeam(division_id: number, team_id: number) {
    return await this.dataLoader.getTeam(0, division_id, team_id);
  }

  async getTeamRank(division_id: number, team_id: number, tags?: number[]) {
    return await this.dataLoader.getTeamRank(0, division_id, team_id, tags);
  }

  async getChallengesSummary(division_id: number) {
    return await this.dataLoader.getChallengeSummary(0, division_id);
  }

  async getChallengeSolves(division_id: number, challenge_id: number) {
    return this.dataLoader.getChallengeSolves(0, division_id, challenge_id);
  }

  async computeAndSaveScoreboards(timestamp?: Date) {
    this.logger.info({ event_timestamp: timestamp }, "Computing scoreboard");
    const { challenges, teams, divisions } =
      await this.fetchScoreboardCalculationParams(timestamp);
    if (!divisions.length || !teams.size) return;

    await this.dataLoader.saveTeamTags(
      teams
        .values()
        .flatMap((v) => v)
        .toArray(),
    );

    for (const { id } of divisions) {
      await this.commitDivisionScoreboard(
        teams.get(id) || [],
        challenges,
        id,
        timestamp,
      );
    }
  }

  async computeFullGraph() {
    const { challenges, teams, divisions } =
      await this.fetchScoreboardCalculationParams();

    let points: HistoryDataPoint[] = [];
    for (const { id } of divisions) {
      const [solveList, awardList] = await Promise.all([
        this.submissionDAO.getSolvesForCalculation(id),
        this.awardDAO.getAllAwards(id),
      ]);
      const solvesByChallenge = new Map<number, RawSolve[]>();
      solveList.forEach((x) => {
        let solves = solvesByChallenge.get(x.challenge_id);
        if (!solves) {
          solves = [];
          solvesByChallenge.set(x.challenge_id, solves);
        }
        solves.push(x);
      });
      points = points.concat(
        ComputeFullGraph(
          new Map(teams.get(id)?.map((x) => [x.id, x])),
          challenges,
          solvesByChallenge,
          awardList,
        ),
      );
    }
    await this.history.replaceAll(
      points,
      divisions.map(({ id }) => id),
    );
  }

  async getTopScoreHistory(division: number, count: number, tags?: number[]) {
    const {
      value: { start_time_s, end_time_s },
    } = await this.configService.get(SetupConfig);
    const start = start_time_s !== undefined ? start_time_s * 1000 : undefined;
    const end = end_time_s !== undefined ? end_time_s * 1000 : undefined;
    const [_count, ranks] = await this.dataLoader.getRanks(
      0,
      division,
      0,
      count - 1,
      tags,
    );
    const data = await this.history.getHistoryForTeams(ranks);
    const partitions: { team_id: number; graph: [number, number][] }[] = [];
    ranks.forEach((team_id) => {
      const graph = data.get(team_id) || [];
      partitions.push({
        team_id,
        graph: this.filterGraph(graph, start, end),
      });
    });
    return partitions;
  }

  async getTeamScoreHistory(id: number) {
    const {
      value: { start_time_s, end_time_s },
    } = await this.configService.get(SetupConfig);
    const start = start_time_s !== undefined ? start_time_s * 1000 : undefined;
    const end = end_time_s !== undefined ? end_time_s * 1000 : undefined;
    const data = await this.history.getHistoryForTeams([id]);
    return this.filterGraph(data.get(id) || [], start, end);
  }

  private filterGraph(
    graph: [number, number][],
    startTime?: number,
    endTime?: number,
  ) {
    let start = 0;
    let end = graph.length;
    if (startTime !== undefined) {
      start = bisectLeft(graph, startTime, ([v]) => v);
    }
    if (endTime !== undefined) {
      end = bisectRight(graph, endTime, ([v]) => v);
    }
    return graph.slice(start, end);
  }

  private async fetchScoreboardCalculationParams(timestamp?: Date) {
    const divisions = (
      await Promise.all(
        (await this.divisionDAO.list()).map(async (d) => {
          const pointer = await this.dataLoader.getLatestPointer(d.id, false);
          if (!timestamp || !pointer || pointer < timestamp.getTime()) {
            this.logger.info(
              { division_id: d.id, timestamp },
              "Queuing division for recalculation",
            );
            return d;
          }
          this.logger.info(
            { division_id: d.id, pointer },
            "Skipping recalculation for division",
          );
          await this.dataLoader.touch(pointer, d.id);
          return null;
        }),
      )
    ).filter((v): v is Exclude<typeof v, null> => !!v);
    if (!divisions.length) {
      return {
        teams: new Map<number, MinimalTeamInfo[]>(),
        divisions: [],
        challenges: [],
      };
    }

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

    const teams = await this.teamDAO.listForScoreboard();
    const teamMap = new Map<number, MinimalTeamInfo[]>(
      divisions.map(({ id }) => [id, []] as [number, MinimalTeamInfo[]]),
    );
    teams.forEach((t) => teamMap.get(t.division_id)?.push(t));
    return {
      teams: teamMap,
      divisions,
      challenges,
    };
  }

  private async commitDivisionScoreboard(
    teams: MinimalTeamInfo[],
    challenges: ChallengeMetadataWithExpr[],
    id: number,
    timestamp?: Date,
  ) {
    const [solveList, awardList] = await Promise.all([
      this.submissionDAO.getSolvesForCalculation(id),
      this.awardDAO.getAllAwards(id),
    ]);

    const solvesByChallenge = new Map<number, RawSolve[]>();
    solveList.forEach((x) => {
      if (timestamp && x.created_at > timestamp) return;
      let solves = solvesByChallenge.get(x.challenge_id);
      if (!solves) {
        solves = [];
        solvesByChallenge.set(x.challenge_id, solves);
      }
      solves.push(x);
    });

    const {
      last_event,
      scoreboard,
      challenges: challengeScores,
    } = ComputeScoreboard(
      new Map(teams.map((x) => [x.id, x])),
      challenges,
      solvesByChallenge,
      timestamp
        ? awardList.filter((x) => x.created_at <= timestamp)
        : awardList,
    );

    await this.dataLoader.saveIndexed(
      MaxDate(timestamp || new Date(0), last_event).getTime(),
      id,
      scoreboard,
      challengeScores,
      true,
    );
    await this.history.saveIteration(id, scoreboard);
  }
}
