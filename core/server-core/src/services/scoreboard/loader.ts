import {
  ScoreboardEntry,
  ScoreboardVersionData,
  Solve,
} from "@noctf/api/datatypes";
import { RedisClientFactory } from "../../clients/redis.ts";
import { decode, encode } from "cbor-x";
import { ComputedChallengeScoreData } from "./calc.ts";
import { Compress, Decompress } from "../../util/message_compression.ts";
import { Coleascer } from "../../util/coleascer.ts";
import { RunInParallelWithLimit } from "../../util/semaphore.ts";
import { MinimalTeamInfo } from "../../dao/team.ts";
import { LocalCache } from "../../util/local_cache.ts";

const SCRIPT_PREPARE_RANK = `
local dest_key = KEYS[1]
local ranks_key = KEYS[2]
local num_keys = #KEYS - 2
local source_keys = {}
for i = 1, num_keys do
  source_keys[i] = KEYS[i + 2]
end

local count = nil

if num_keys > 0 then
  local exists = redis.call('EXISTS', dest_key)
  if exists == 0 then
    redis.call('SUNIONSTORE', dest_key, unpack(source_keys))
    count = redis.call('ZINTERSTORE', dest_key, 2, ranks_key, dest_key)
    redis.call('EXPIRE', dest_key, 60)
  end
end`;

const SCRIPT_GET_SCOREBOARD = `
local ranks_key = KEYS[1]
local teams_key = KEYS[2]
local exists = redis.call('EXISTS', ranks_key)
if exists == 0 then
  return nil
end

local teams = redis.call('ZRANGE', ranks_key, ARGV[1], ARGV[2])
local ret = {}
ret[1] = redis.call('ZCARD', ranks_key)
ret[2] = redis.call('HMGET', teams_key, unpack(teams))
return ret`;

export class ScoreboardDataLoader {
  constructor(
    private readonly factory: RedisClientFactory,
    private readonly namespace: string,
  ) {}

  private readonly pointerCache = new LocalCache<
    string,
    ScoreboardVersionData | null
  >({
    max: 512,
    ttl: 1000,
  });

  private readonly getScoreboardCoaleascer = new Coleascer();
  private readonly getChallengesCoalescer = new Coleascer();
  private readonly getTeamCoalescer = new Coleascer();

  async saveTeamTags(teams: MinimalTeamInfo[]) {
    const tags = new Map<number, number[]>();
    for (const { id, tag_ids } of teams) {
      for (const tid of tag_ids) {
        let ids = tags.get(tid);
        if (!ids) {
          ids = [];
          tags.set(tid, ids);
        }
        ids.push(id);
      }
    }
    const client = await this.factory.getClient();
    const multi = client.multi();
    for (const [id, teams] of tags) {
      const key = `${this.namespace}:tt:${id}`;
      multi.del(key);
      multi.sAdd(
        key,
        teams.map((id) => id.toString()),
      );
      multi.expire(key, 300);
    }
    await multi.exec();
  }

  async getScoreboard(
    pointer: string | number,
    division_id: number,
    start: number,
    end: number,
    tags?: number[],
  ): Promise<{ total: number; entries: ScoreboardEntry[] }> {
    const version = await this.getVersionPointer(pointer, division_id);
    if (!version) return { total: 0, entries: [] };
    const sTags = [...new Set(tags)].sort();

    return this.getScoreboardCoaleascer.get(
      `${version}:${division_id}:${start}:${end}:${sTags.join()}`,
      async () => {
        const keys = this.getCacheKeys(version, division_id);
        const set = sTags.length
          ? `${keys.ranktag}:${sTags.join(",")}`
          : keys.rank;

        let result: [number, Buffer[]] | null;
        result = await this.factory.executeScript(
          SCRIPT_GET_SCOREBOARD,
          [set, keys.team],
          [start.toString(), end.toString()],
          true,
        );
        if (!result && !sTags.length) return { total: 0, entries: [] };
        if (result) {
          const entries = (
            await RunInParallelWithLimit(result[1], 8, async (x) => {
              return decode(await Decompress(x));
            })
          )
            .map((x) => x.status === "fulfilled" && x.value)
            .filter((x) => x) as ScoreboardEntry[];
          return { total: result[0], entries };
        }
        await this.createTaggedRankTable(set, keys.rank, sTags);
        result = await this.factory.executeScript(
          SCRIPT_GET_SCOREBOARD,
          [set, keys.team],
          [start.toString(), end.toString()],
          true,
        );
        if (!result) return { total: 0, entries: [] };

        const entries = (
          await RunInParallelWithLimit(result[1], 8, async (x) => {
            return decode(await Decompress(x));
          })
        )
          .map((x) => x.status === "fulfilled" && x.value)
          .filter((x) => x) as ScoreboardEntry[];
        return { total: result[0], entries };
      },
    );

    // return this.getScoreboardCoaleascer.get(
    //   `${version}:${division_id}:${start}:${end}:${sTags.join()}`,
    //   async () => {
    //     const client = await this.factory.getClient();
    //     const [total, ranks] = await this.getRanks(pointer, division_id, start, end, tags);
    //     const compressed = await client.hmGet(
    //       client.commandOptions({ returnBuffers: true }),
    //       keys.team,
    //       ranks.map((r) => r.toString()),
    //     );
    //     const entries = (
    //       await RunInParallelWithLimit(compressed, 8, async (x) => {
    //         return decode(await Decompress(x));
    //       })
    //     )
    //       .map((x) => x.status === "fulfilled" && x.value)
    //       .filter((x) => x) as ScoreboardEntry[];
    //     return { total, entries };
    //   },
    // );
  }

  async getRanks(
    pointer: string | number,
    division_id: number,
    start: number,
    end: number,
    tags?: number[],
  ): Promise<[number, number[]]> {
    const client = await this.factory.getClient();
    const query = async (k: string) => {
      const multi = client.multi();
      multi.exists(k);
      multi.zCard(k);
      multi.zRange(k, start, end);
      const result = (await multi.exec()) as [number, number, string[]];
      if (!result[0]) return null;
      return [result[1], result[2].map((x) => parseInt(x))] as [
        number,
        number[],
      ];
    };
    const version = await this.getVersionPointer(pointer, division_id);
    if (!version) return [0, []];
    const keys = this.getCacheKeys(version, division_id);

    let result: [number, number[]] | null;
    if (!tags || !tags.length) {
      result = await query(keys.rank);
      if (!result) return [0, []];
      return result;
    }
    const sTags = [...new Set(tags)].sort();
    const rankKey = `${keys.ranktag}:${sTags.join(",")}`;

    result = await query(rankKey);
    if (!result) await this.createTaggedRankTable(rankKey, keys.rank, sTags);
    result = await query(rankKey);
    if (!result) return [0, []];
    return result;
  }

  async getChallengeSolves(
    pointer: string | number,
    division_id: number,
    challenge: number,
  ): Promise<Solve[]> {
    const version = await this.getVersionPointer(pointer, division_id);
    if (!version) return [];
    const keys = this.getCacheKeys(version, division_id);

    return this.getChallengesCoalescer.get(
      `${division_id}:${challenge}`,
      async () => {
        const client = await this.factory.getClient();
        const compressed = await client.hGet(
          client.commandOptions({ returnBuffers: true }),
          keys.csolves,
          challenge.toString(),
        );
        return compressed ? decode(await Decompress(compressed)) : [];
      },
    );
  }

  async getTeam(
    pointer: string | number,
    division_id: number,
    team: number,
  ): Promise<ScoreboardEntry | null> {
    const version = await this.getVersionPointer(pointer, division_id);
    if (!version) return null;
    const keys = this.getCacheKeys(version, division_id);
    return this.getTeamCoalescer.get(
      `${version}:${division_id}:${team}`,
      async () => {
        const client = await this.factory.getClient();
        const compressed = await client.hGet(
          client.commandOptions({ returnBuffers: true }),
          keys.team,
          team.toString(),
        );
        return compressed ? decode(await Decompress(compressed)) : null;
      },
    );
  }

  async saveIndexed(
    version: number,
    division_id: number,
    scoreboard: ScoreboardEntry[],
    challenges: Map<number, ComputedChallengeScoreData>,
  ): Promise<ScoreboardVersionData> {
    const client = await this.factory.getClient();
    const keys = this.getCacheKeys(version, division_id);

    const teams = (
      await RunInParallelWithLimit(scoreboard, 8, async (x) => {
        return [x.team_id.toString(), await Compress(encode(x))] as [
          string,
          Buffer,
        ];
      })
    )
      .map((x) => x.status === "fulfilled" && x.value)
      .filter((x) => x) as [string, Buffer][];
    const csolves = (
      await RunInParallelWithLimit(
        challenges.values(),
        8,
        async ({ challenge_id, solves }) => [
          challenge_id.toString(),
          await Compress(encode(solves)),
        ],
      )
    )
      .map((x) => x.status === "fulfilled" && x.value)
      .filter((x) => x) as [string, Buffer][];

    const multi = client.multi();
    const saved: string[] = [];
    if (scoreboard.length)
      multi.zAdd(
        keys.rank,
        scoreboard
          .filter((x) => !x.hidden)
          .map(({ rank, team_id }) => ({
            score: rank,
            value: team_id.toString(),
          })),
      );
    if (teams.length) multi.hSet(keys.team, teams);
    if (csolves.length) multi.hSet(keys.csolves, csolves);
    for (const key of saved) {
      multi.expire(key, 300);
    }
    await multi.exec();

    return {
      division_id,
      version,
    };
  }

  async getVersionPointer(pointer: string | number, division_id: number) {
    if (typeof pointer === "number") return pointer;
    return (
      await this.pointerCache.load(`${pointer}:${division_id}`, async () => {
        const client = await this.factory.getClient();
        const result = await client.get(
          `${this.getDivisionString(division_id)}:p:${pointer}`,
        );
        return result ? (JSON.parse(result) as ScoreboardVersionData) : null;
      })
    )?.version;
  }

  async saveVersionPointer(pointer: string, data: ScoreboardVersionData) {
    const client = await this.factory.getClient();
    await client.set(
      `${this.getDivisionString(data.division_id)}:p:${pointer}`,
      JSON.stringify(data),
    );
  }

  private getDivisionString(division: number) {
    return `${this.namespace}:d:${division}`;
  }

  private getCacheKeys(version: number, division: number) {
    const root = `${this.getDivisionString(division)}:v:${version}`;
    return {
      rank: `${root}:rank`,
      team: `${root}:team`,
      csolves: `${root}:csolves`,
      ranktag: `${root}:ranktag`,
    };
  }

  private async createTaggedRankTable(
    taggedKey: string,
    rankKey: string,
    sortedTags: number[],
  ) {
    await this.factory.executeScript(
      SCRIPT_PREPARE_RANK,
      [
        taggedKey,
        rankKey,
        ...sortedTags.map((id) => `${this.namespace}:tt:${id}`),
      ],
      [],
    );
  }
}
