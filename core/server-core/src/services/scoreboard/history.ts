import { ScoreboardEntry } from "@noctf/api/datatypes";
import { GetChangedTeamScores, GetMinimalScoreboard } from "./calc.ts";
import { HistoryDataPoint, ScoreHistoryDAO } from "../../dao/score_history.ts";
import { decode, encode } from "cbor-x";
import { Compress, Decompress } from "../../util/message_compression.ts";
import { ServiceCradle } from "../../index.ts";
import { ScoreboardDataLoader } from "./loader.ts";

const CACHE_NAMESPACE = "core:svc:score:history";
const CACHE_DATA_HASH_KEY = `${CACHE_NAMESPACE}:data`;

type Props = Pick<ServiceCradle, "databaseClient" | "redisClientFactory">;

export class ScoreboardHistory {
  private readonly redisClientFactory;
  private readonly scoreHistoryDAO;

  constructor({ databaseClient, redisClientFactory }: Props) {
    this.redisClientFactory = redisClientFactory;
    this.scoreHistoryDAO = new ScoreHistoryDAO(databaseClient.get());
  }

  async saveIteration(division: number, scoreboard: ScoreboardEntry[]) {
    const minimal = GetMinimalScoreboard(scoreboard);
    const last = await this.getLastData(division);
    const diff = GetChangedTeamScores(last, minimal);
    await this.scoreHistoryDAO.add(diff);
    const encoded = await Compress(encode(minimal));
    const multi = (await this.redisClientFactory.getClient()).multi();
    multi.set(`${CACHE_NAMESPACE}:calc:${division}`, encoded as Buffer, {
      EX: 600,
    });
    multi.del(CACHE_DATA_HASH_KEY);
    await multi.exec();
  }

  async getHistoryForTeams(
    teams: number[],
  ): Promise<Map<number, [number, number][]>> {
    if (!teams.length) return new Map();
    const client = await this.redisClientFactory.getClient();
    const data = await client.hmGet(
      client.commandOptions({ returnBuffers: true }),
      CACHE_DATA_HASH_KEY,
      teams.map((t) => t.toString()),
    );
    const out = new Map<number, [number, number][]>();
    const missing = teams.filter((t, i) => {
      if (!data[i]) return true;
      out.set(t, decode(data[i]));
      return false;
    });
    const fetched = new Map<number, [number, number][]>();
    (await this.scoreHistoryDAO.getByTeams(missing)).forEach(
      ({ team_id, score, updated_at }) => {
        let team = fetched.get(team_id);
        if (!team) {
          team = [];
          fetched.set(team_id, team);
        }
        team.push([updated_at.getTime(), score]);
      },
    );

    if (fetched.size) {
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
      fetched.forEach((v, k) => out.set(k, v));
    }
    return out;
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
