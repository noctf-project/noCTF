import type { ServiceCradle } from "../../index.ts";
import { SetupConfig } from "@noctf/api/config";
import { ScoreboardDataLoader } from "./loader.ts";
import { ScoreboardHistory } from "./history.ts";
import { LocalCache } from "../../util/local_cache.ts";

type Props = Pick<
  ServiceCradle,
  "configService" | "databaseClient" | "redisClientFactory"
>;

export class ScoreboardService {
  private readonly configService;
  private readonly history;
  private readonly dataLoader;

  private readonly pointerCache = new LocalCache<
    number,
    Record<string, number>
  >({
    max: 256,
    ttl: 1000,
  });

  constructor({ configService, databaseClient, redisClientFactory }: Props) {
    this.configService = configService;
    this.dataLoader = new ScoreboardDataLoader(redisClientFactory);
    this.history = new ScoreboardHistory({
      redisClientFactory,
      databaseClient,
    });
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
    // Configured bounds include the whole final second; explicit dates stay precise.
    const cutoff =
      endTime ??
      (end_time_s !== undefined
        ? new Date(end_time_s * 1000 + 999)
        : undefined);
    const data = await this.history.getHistoryForTeams(id, cutoff);
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
      let t = startTime !== undefined ? ts : graph[0][0];
      if (t > endTime) {
        return [[], []];
      }

      for (end = start + 1; end < graph[0].length; end++) {
        if ((t += graph[0][end]) > endTime) {
          break;
        }
      }
    }

    const x = graph[0].slice(start, end);
    const y = graph[1].slice(start, end);
    if (start === 0) return [x, y];
    x[0] = ts;
    y[0] = score;

    return [x, y];
  }
}
