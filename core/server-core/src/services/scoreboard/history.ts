import { ScoreboardEntry } from "@noctf/api/datatypes";
import { GetChangedTeamScores, GetMinimalScoreboard } from "./calc.ts";
import { HistoryDataPoint, ScoreHistoryDAO } from "../../dao/score_history.ts";
import { decode, encode } from "cbor-x";
import { Compress, Decompress } from "../../util/message_compression.ts";
import { ServiceCradle } from "../../index.ts";
import { ScoreboardDataLoader } from "./loader.ts";
import { Coleascer } from "../../util/coleascer.ts";

const CACHE_NAMESPACE = "core:svc:score:history";
const CACHE_DATA_HASH_KEY = `${CACHE_NAMESPACE}:data`;

type Props = Pick<ServiceCradle, "databaseClient" | "redisClientFactory">;

type DataPoint = [number, number];
export class ScoreboardHistory {
  private readonly databaseClient;
  private readonly redisClientFactory;
  private readonly scoreHistoryDAO;

  private readonly teamColeascer = new Coleascer<DataPoint[]>();

  constructor({ databaseClient, redisClientFactory }: Props) {
    this.databaseClient = databaseClient;
    this.redisClientFactory = redisClientFactory;
    this.scoreHistoryDAO = new ScoreHistoryDAO(databaseClient.get());
  }

  async saveIteration(division: number, scoreboard: ScoreboardEntry[]) {
    const hidden = new Set<number>(
      scoreboard.filter((x) => x.hidden).map((x) => x.team_id),
    );
    const minimal = GetMinimalScoreboard(scoreboard);
    const last = await this.getLastData(division);
    const diff = GetChangedTeamScores(last, minimal);
    await this.scoreHistoryDAO.add(
      diff
        .filter((x) => !hidden.has(x.team_id))
        .map(({ updated_at, ...rest }) => rest),
    );
    const encoded = await Compress(encode(minimal));
    const multi = (await this.redisClientFactory.getClient()).multi();
    multi.set(`${CACHE_NAMESPACE}:calc:${division}`, encoded as Buffer, {
      EX: 600,
    });
    multi.del(CACHE_DATA_HASH_KEY);
    await multi.exec();
  }

  async replaceAll(data: HistoryDataPoint[], divisions: number[]) {
    await this.databaseClient.transaction(async (tx) => {
      const dao = new ScoreHistoryDAO(tx);
      await dao.flushAll();
      await dao.add(data);
    });
    const client = await this.redisClientFactory.getClient();
    const multi = client.multi();
    multi.del(CACHE_DATA_HASH_KEY);
    divisions.forEach((d) => multi.del(`${CACHE_NAMESPACE}:calc:${d}`));
    await multi.exec();
  }

  async getHistoryForTeams(teams: number[]): Promise<Map<number, DataPoint[]>> {
    if (!teams.length) return new Map();
    const client = await this.redisClientFactory.getClient();
    const data = await client.hmGet(
      client.commandOptions({ returnBuffers: true }),
      CACHE_DATA_HASH_KEY,
      teams.map((t) => t.toString()),
    );
    const out = new Map<number, DataPoint[]>();
    const inProgress = new Map<number, Promise<DataPoint[]>>();
    const missing = teams.filter((t, i) => {
      if (data[i]) {
        out.set(t, decode(data[i]));
        return false;
      }
      const promise = this.teamColeascer.get(t);
      if (promise) {
        inProgress.set(t, promise);
        return false;
      }
      if (!data[i]) return true;
    });
    const toFetch = new Map<number, PromiseWithResolvers<DataPoint[]>>(
      missing.map((t) => {
        const result: [number, PromiseWithResolvers<DataPoint[]>] = [
          t,
          Promise.withResolvers(),
        ];
        this.teamColeascer.put(t, result[1].promise);
        return result;
      }),
    );
    if (toFetch.size) {
      const fetched = await this.fetchFromDatabase(toFetch);
      fetched.forEach((v, k) => out.set(k, v));
    }
    for (const [team, promise] of inProgress) {
      out.set(team, await promise.catch(() => [] as DataPoint[])); // we want to return at least sth
    }
    return out;
  }

  private async fetchFromDatabase(
    toFetch: Map<number, PromiseWithResolvers<DataPoint[]>>,
  ) {
    const fetched = new Map<number, DataPoint[]>(
      toFetch.keys().map((t) => [t, []] as [number, DataPoint[]]),
    );
    const client = await this.redisClientFactory.getClient();
    let lastTeamId: number | undefined;
    let lastUpdated = 0;
    let lastScore = 0;
    try {
      // We are assuming that this is sorted by team and then updated_at
      (await this.scoreHistoryDAO.getByTeams(toFetch.keys().toArray())).forEach(
        ({ team_id, score, updated_at }) => {
          const team = fetched.get(team_id);
          // this shouldn't happen
          if (!team) {
            throw new Error("team missing from fetched");
          }
          if (lastTeamId !== team_id) {
            lastTeamId = team_id;
            lastUpdated = 0;
            lastScore = 0;
          }
          const updated = Math.floor(updated_at.getTime() / 1000);
          if (team.length && updated === team[team.length - 1][0]) {
            team[team.length - 1][1] = score - lastScore;
          } else {
            team.push([updated_at.getTime() - lastUpdated, score - lastScore]);
          }
          lastUpdated = updated;
          lastScore = score;
        },
      );
      toFetch.forEach(({ resolve }, t) => resolve(fetched.get(t)!));
    } catch (e) {
      toFetch.forEach(({ reject }) => reject(e));
      throw e;
    }
    const multi = client.multi();
    client.hSet(
      CACHE_DATA_HASH_KEY,
      fetched
        .entries()
        .map(
          ([team, series]) =>
            [team.toString(), encode(series)] as [string, Buffer],
        )
        .toArray(),
    );
    multi.expire(CACHE_DATA_HASH_KEY, 600);
    await multi.exec();
    return fetched;
  }

  private async getLastData(division: number): Promise<HistoryDataPoint[]> {
    const client = await this.redisClientFactory.getClient();
    const cached = await client.get(
      client.commandOptions({ returnBuffers: true }),
      `${CACHE_NAMESPACE}:calc:${division}`,
    );
    if (!cached) return this.scoreHistoryDAO.listMostRecentByDivision(division);
    try {
      return decode(await Decompress(cached));
    } catch (e) {
      return this.scoreHistoryDAO.listMostRecentByDivision(division);
    }
  }
}
