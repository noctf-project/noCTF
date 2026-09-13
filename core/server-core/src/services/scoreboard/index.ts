import type { ServiceCradle } from "../../index.ts";
import { DivisionDAO } from "../../dao/division.ts";
import {
  ChallengeMetadataWithExpr,
  ComputeFullGraph,
  ComputeScoreboard,
  PartitionSolvesByChallenge,
} from "./calc.ts";
import { HistoryDataPoint } from "../../dao/score_history.ts";
import { SetupConfig } from "@noctf/api/config";
import { AwardDAO } from "../../dao/award.ts";
import { ScoreboardDataLoader } from "./loader.ts";
import { MinimalTeamInfo, TeamDAO } from "../../dao/team.ts";
import { RawSolve, SubmissionDAO } from "../../dao/submission.ts";
import { Award, ScoreboardEntry } from "@noctf/api/datatypes";
import { MaxDate } from "../../util/date.ts";
import { ScoreboardHistory } from "./history.ts";
import { LocalCache } from "../../util/local_cache.ts";

type PointerTarget = {
  name: string;
  cutoff?: Date;
};

type DivisionContext = {
  division_id: number;
  teams: MinimalTeamInfo[];
  challenges: ChallengeMetadataWithExpr[];
  solves: RawSolve[];
  awards: Award[];
  setup: SetupConfig;
  timestamp?: Date;
};

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

  private readonly pointerCache = new LocalCache<
    number,
    Record<string, number>
  >({
    max: 256,
    ttl: 1000,
  });

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

  private async getPointers(
    division_id: number,
    cached = true,
  ): Promise<Record<string, number>> {
    if (!cached) this.pointerCache.delete(division_id);
    return (
      (await this.pointerCache.load(division_id, () =>
        this.dataLoader.getPointers(division_id, ["latest", "frozen"]),
      )) ?? {}
    );
  }

  async getFreezeTime(): Promise<Date | null> {
    const { value: setup } = await this.configService.get(SetupConfig);
    if (!setup.freeze_time_s) return null;
    const freezeDate = new Date(setup.freeze_time_s * 1000);
    return Date.now() >= freezeDate.getTime() ? freezeDate : null;
  }

  async isFrozen(): Promise<boolean> {
    const { value: setup } = await this.configService.get(SetupConfig);
    return Boolean(
      setup.freeze_time_s && Date.now() >= setup.freeze_time_s * 1000,
    );
  }

  private async resolveVersion(
    division_id: number,
    pointer?: string,
  ): Promise<number | null> {
    const pointers = await this.getPointers(division_id);
    if (pointer) {
      return pointers[pointer] ?? null;
    }
    const freezeTime = await this.getFreezeTime();
    if (freezeTime && pointers.frozen) {
      return pointers.frozen;
    }
    return pointers.latest ?? null;
  }

  async getScoreboard(
    division_id: number,
    start: number,
    end: number,
    tags?: number[],
    pointer?: string,
  ) {
    const version = await this.resolveVersion(division_id, pointer);
    if (!version) return { total: 0, entries: [] };
    return this.dataLoader.getScoreboard(
      division_id,
      version,
      start,
      end,
      tags,
    );
  }

  async getTeam(division_id: number, team_id: number, pointer?: string) {
    const version = await this.resolveVersion(division_id, pointer);
    if (!version) return null;
    return await this.dataLoader.getTeam(division_id, version, team_id);
  }

  async getTeamRank(
    division_id: number,
    team_id: number,
    tags?: number[],
    pointer?: string,
  ) {
    const version = await this.resolveVersion(division_id, pointer);
    if (!version) return null;
    return await this.dataLoader.getTeamRank(
      division_id,
      version,
      team_id,
      tags,
    );
  }

  async getChallengesSummary(division_id: number, pointer?: string) {
    const version = await this.resolveVersion(division_id, pointer);
    if (!version) return {};
    return await this.dataLoader.getChallengeSummary(division_id, version);
  }

  async getChallengeSolves(
    division_id: number,
    challenge_id: number,
    pointer?: string,
  ) {
    const version = await this.resolveVersion(division_id, pointer);
    if (!version) return [];
    return this.dataLoader.getChallengeSolves(
      division_id,
      version,
      challenge_id,
    );
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

    for (const { division, pointers } of divisions) {
      await this.commitDivisionScoreboard(
        teams.get(division.id) || [],
        challenges,
        division.id,
        pointers,
        timestamp,
      );
    }
  }

  async recomputeFullGraph() {
    const { challenges, teams, divisions } =
      await this.fetchScoreboardCalculationParams();

    let points: HistoryDataPoint[] = [];
    for (const {
      division: { id },
    } of divisions) {
      const [solveList, awardList, { value: setup }] = await Promise.all([
        this.submissionDAO.getSolvesForCalculation(id),
        this.awardDAO.getAllAwards(id),
        this.configService.get(SetupConfig),
      ]);
      const solvesByChallenge = PartitionSolvesByChallenge(solveList, setup);
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
      divisions.map(({ division: { id } }) => id),
    );
  }

  async getTeamScoreHistory(id: number[], endTime?: Date) {
    const {
      value: { start_time_s, end_time_s },
    } = await this.configService.get(SetupConfig);
    const start = start_time_s !== undefined ? start_time_s : undefined;
    const cutoffTimeS =
      endTime !== undefined ? Math.floor(endTime.getTime() / 1000) : undefined;
    // When endTime is explicit (e.g. freeze cutoff or post-end adjudication/eval window),
    // prioritize it over end_time_s so graph scores stay consistent with the scoreboard.
    const end = cutoffTimeS !== undefined ? cutoffTimeS : end_time_s;
    const data = await this.history.getHistoryForTeams(id);
    return new Map(
      data
        .entries()
        .map(([id, graph]) => [id, this.filterGraph(graph, start, end)]),
    );
  }

  private filterGraph(
    graph: [number[], number[]],
    startTime?: number,
    endTime?: number,
  ): [number[], number[]] {
    if (graph[0].length === 0) return [[], []];
    if (
      startTime !== undefined &&
      endTime !== undefined &&
      endTime < startTime
    ) {
      return [[], []];
    }
    let start = 0;
    let end = graph[0].length;
    let ts = 0;
    let score = 0;
    if (startTime !== undefined) {
      for (; start < graph[0].length; start++) {
        score += graph[1][start];
        if ((ts += graph[0][start]) >= startTime) {
          break;
        }
      }
    }
    if (start >= graph[0].length) {
      return [[], []];
    }
    if (endTime !== undefined) {
      if (start === 0 && graph[0][0] > endTime) {
        return [[], []];
      }
      let t = ts || graph[0][0];

      for (end = start + 1; end < graph[0].length; end++) {
        if ((t += graph[0][end]) > endTime) {
          break;
        }
      }
    }

    const x = graph[0].slice(start, end);
    const y = graph[1].slice(start, end);
    if (start === 0) return [x, y];
    if (x[0] && ts !== 0) {
      x[0] = ts;
      y[0] = score;
    }

    return [x, y];
  }

  private getTargetPointers(setup: SetupConfig): {
    name: string;
    cutoff?: Date;
  }[] {
    const targets: { name: string; cutoff?: Date }[] = [];
    if (typeof setup.freeze_time_s === "number") {
      const freezeDate = new Date(setup.freeze_time_s * 1000);
      if (Date.now() >= freezeDate.getTime()) {
        targets.push({ name: "frozen", cutoff: freezeDate });
      }
    }
    targets.push({ name: "latest" });
    return targets;
  }

  private async fetchScoreboardCalculationParams(timestamp?: Date) {
    const { value: setup } = await this.configService.get(SetupConfig);
    const targetPointers = this.getTargetPointers(setup);

    const divisions = (
      await Promise.all(
        (await this.divisionDAO.list()).map(async (d) => {
          const currentPointers = await this.getPointers(d.id, false);

          const isUpToDate = targetPointers.every(({ name, cutoff }) => {
            const current = currentPointers[name];
            if (!current) return false;
            if (cutoff) {
              return current === cutoff.getTime();
            }
            // For pointers without cutoff (e.g. "latest"), up to date if current >= timestamp
            return Boolean(timestamp && current >= timestamp.getTime());
          });

          if (!isUpToDate) {
            this.logger.info(
              { division_id: d.id, timestamp },
              "Queuing division for recalculation",
            );
            return { division: d, pointers: currentPointers };
          }

          this.logger.info(
            { division_id: d.id, currentPointers },
            "Skipping recalculation for division",
          );
          await this.dataLoader.touchDivision(d.id, currentPointers);
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
      divisions.map(
        ({ division: { id } }) => [id, []] as [number, MinimalTeamInfo[]],
      ),
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
    currentPointers: Record<string, number>,
    timestamp?: Date,
  ) {
    const [solves, awards, { value: setup }] = await Promise.all([
      this.submissionDAO.getSolvesForCalculation(id),
      this.awardDAO.getAllAwards(id),
      this.configService.get(SetupConfig),
    ]);

    const ctx: DivisionContext = {
      division_id: id,
      teams,
      challenges,
      solves,
      awards,
      setup,
      timestamp,
    };

    const targetPointers = this.getTargetPointers(setup);
    const prevVersions = Object.values(currentPointers).filter(Boolean);
    const activeVersions = new Set<number>();

    let latestScoreboard: ScoreboardEntry[] = [];

    for (const target of targetPointers) {
      const prevVersion = currentPointers[target.name];
      const targetVersion = target.cutoff?.getTime();

      // If pointer has a fixed target version (e.g. cutoff) and is already at that version, just touch
      if (targetVersion && prevVersion === targetVersion) {
        await this.dataLoader.touchDivision(id, {
          [target.name]: targetVersion,
        });
        activeVersions.add(targetVersion);
        continue;
      }

      const res = await this.commitDivisionForPointer(ctx, target);
      activeVersions.add(res.version);
      if (target.name === "latest") {
        latestScoreboard = res.scoreboard;
      }
    }

    if (latestScoreboard.length) {
      await this.history.saveIteration(id, latestScoreboard);
    }

    // Expire unused versions somewhat eagerly (with a small grace period)
    const toExpire = prevVersions.filter((v) => !activeVersions.has(v));
    await this.dataLoader.expireVersions(id, toExpire, 10);
    this.pointerCache.delete(id);
  }

  private async commitDivisionForPointer(
    ctx: DivisionContext,
    target: PointerTarget,
  ): Promise<{ version: number; scoreboard: ScoreboardEntry[] }> {
    const targetVersion = target.cutoff?.getTime();
    const solvesByChallenge = PartitionSolvesByChallenge(
      ctx.solves,
      ctx.setup,
      target.cutoff,
    );

    const {
      last_event,
      scoreboard,
      challenges: challengeScores,
    } = ComputeScoreboard(
      new Map(ctx.teams.map((x) => [x.id, x])),
      ctx.challenges,
      solvesByChallenge,
      target.cutoff
        ? ctx.awards.filter((x) => x.created_at <= target.cutoff!)
        : ctx.awards,
    );

    if (target.cutoff) {
      for (const entry of scoreboard) {
        if (entry.updated_at > target.cutoff) {
          entry.updated_at = target.cutoff;
        }
        if (entry.last_solve > target.cutoff) {
          entry.last_solve = target.cutoff;
        }
      }
    }

    const version = targetVersion
      ? targetVersion
      : MaxDate(ctx.timestamp || new Date(0), last_event).getTime();

    await this.dataLoader.saveIndexed(
      ctx.division_id,
      version,
      scoreboard,
      challengeScores,
      target.name,
    );

    return { version, scoreboard };
  }
}
