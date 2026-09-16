import {
  ScoreboardEntry,
  ScoreboardVersionData,
  Solve,
} from "@noctf/api/datatypes";
import { RedisClientFactory } from "../../clients/redis.ts";
import { decode, encode } from "cbor-x";
import { ChallengeSummary, ComputedChallengeScoreData } from "./calc.ts";
import { Compress, Decompress } from "../../util/message_compression.ts";
import { Coleascer } from "../../util/coleascer.ts";
import { RunInParallelWithLimit } from "../../util/semaphore.ts";
import { MinimalTeamInfo } from "../../dao/team.ts";

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
if #teams > 0 then
  ret[2] = redis.call('HMGET', teams_key, unpack(teams))
else
  ret[2] = {}
end
return ret`;

const SCOREBOARD_EXPIRE_TIME = 600;
const CACHE_NAMESPACE = "core:svc:score:data";

export class ScoreboardDataLoader {
  constructor(private readonly factory: RedisClientFactory) {}

  private readonly getScoreboardCoaleascer = new Coleascer<{
    total: number;
    entries: ScoreboardEntry[];
  }>();
  private readonly getChallengesCoalescer = new Coleascer<Solve[]>();
  private readonly getSummaryCoalescer = new Coleascer<
    Record<number, ChallengeSummary>
  >();
  private readonly getTeamCoalescer = new Coleascer<ScoreboardEntry | null>();
  private readonly getTeamRankCoalescer = new Coleascer<number | null>();

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
      const key = `${CACHE_NAMESPACE}:tt:${id}`;
      multi.del(key);
      multi.sAdd(
        key,
        teams.map((id) => id.toString()),
      );
      multi.expire(key, SCOREBOARD_EXPIRE_TIME);
    }
    await multi.exec();
  }

  async getScoreboard(
    division_id: number,
    version: number,
    start: number,
    end: number,
    tags?: number[],
  ): Promise<{ total: number; entries: ScoreboardEntry[] }> {
    if (!version) return { total: 0, entries: [] };
    const sTags = [...new Set(tags)].sort();

    return this.getScoreboardCoaleascer.get(
      `${division_id}:${version}:${start}:${end}:${sTags.join()}`,
      async () => {
        const keys = this.getCacheKeys(division_id, version);
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
  }

  async getRanks(
    division_id: number,
    version: number,
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
    if (!version) return [0, []];
    const keys = this.getCacheKeys(division_id, version);

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
    division_id: number,
    version: number,
    challenge: number,
  ): Promise<Solve[]> {
    if (!version) return [];
    const keys = this.getCacheKeys(division_id, version);

    return this.getChallengesCoalescer.get(
      `${division_id}:${version}:${challenge}`,
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
    division_id: number,
    version: number,
    team: number,
  ): Promise<ScoreboardEntry | null> {
    if (!version) return null;
    const keys = this.getCacheKeys(division_id, version);
    return this.getTeamCoalescer.get(
      `${division_id}:${version}:${team}`,
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

  async getTeamRank(
    division_id: number,
    version: number,
    team: number,
    tags?: number[],
  ): Promise<number | null> {
    if (!version) return null;
    const sTags = [...new Set(tags)].sort();
    const keys = this.getCacheKeys(division_id, version);
    return this.getTeamRankCoalescer.get(
      `${division_id}:${version}:${team}:rank:${sTags.join()}`,
      async () => {
        const client = await this.factory.getClient();
        const set = sTags.length
          ? `${keys.ranktag}:${sTags.join(",")}`
          : keys.rank;
        let result = await client.zRank(
          client.commandOptions({ returnBuffers: true }),
          set,
          team.toString(),
        );
        if (result == null && !sTags.length) return null;
        await this.createTaggedRankTable(set, keys.rank, sTags);
        result = await client.zRank(
          client.commandOptions({ returnBuffers: true }),
          set,
          team.toString(),
        );
        if (result == null) return null;
        return result + 1; // zRank will give 0-indexed
      },
    );
  }

  async saveIndexed(
    division_id: number,
    version: number,
    scoreboard: ScoreboardEntry[],
    challenges: Map<number, ComputedChallengeScoreData>,
    pointerName?: string,
  ): Promise<ScoreboardVersionData> {
    const client = await this.factory.getClient();
    const keys = this.getCacheKeys(division_id, version);

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

    const csummary = challenges.values().reduce(
      (prev, { challenge_id, value, solves }) => {
        prev[challenge_id] = {
          challenge_id,
          value,
          solve_count: solves.filter(({ hidden }) => !hidden).length,
          bonuses: solves
            .map(({ bonus }) => bonus)
            .filter((x) => x) as number[], // assuming solves are ordered
        };
        return prev;
      },
      {} as Record<number, ChallengeSummary>,
    );

    const multi = client.multi();
    const saved: string[] = Object.values(keys);
    const visible = scoreboard
      .filter((x) => !x.hidden)
      .map(({ rank, team_id }) => ({
        score: rank,
        value: team_id.toString(),
      }));
    if (visible.length) multi.zAdd(keys.rank, visible);
    if (teams.length) multi.hSet(keys.team, teams);
    if (csolves.length) multi.hSet(keys.csolves, csolves);
    multi.set(keys.csummary, (await Compress(encode(csummary))) as Buffer);
    for (const key of saved) {
      multi.expire(key, SCOREBOARD_EXPIRE_TIME);
    }
    await multi.exec();
    const out = { division_id, version };
    if (pointerName) await this.savePointer(division_id, pointerName, version);
    return out;
  }

  async expireVersions(
    division_id: number,
    versions: number[],
    ttl = 10,
  ): Promise<void> {
    const valid = versions.filter((v) => Boolean(v));
    if (!valid.length) return;

    const multi = (await this.factory.getClient()).multi();
    for (const v of valid) {
      for (const key of Object.values(this.getCacheKeys(division_id, v))) {
        multi.expire(key, ttl);
      }
    }
    await multi.exec();
  }

  async getPointers(
    division_id: number,
    names: string[],
  ): Promise<Record<string, number>> {
    if (!names.length) return {};
    const client = await this.factory.getClient();
    const divPrefix = this.getDivisionString(division_id);
    const keys = names.map((name) => `${divPrefix}:p:${name}`);
    const results = await client.mGet(keys);
    const out: Record<string, number> = {};
    results.forEach((res, i) => {
      if (res) {
        out[names[i]] = (JSON.parse(res) as ScoreboardVersionData).version;
      }
    });
    return out;
  }

  async savePointer(division_id: number, name: string, version: number) {
    const client = await this.factory.getClient();
    const data: ScoreboardVersionData = { division_id, version };
    const key = `${this.getDivisionString(division_id)}:p:${name}`;
    await client.set(key, JSON.stringify(data), { EX: SCOREBOARD_EXPIRE_TIME });
  }

  async touchDivision(
    division_id: number,
    pointers: Record<string, number>,
  ): Promise<void> {
    const names = Object.keys(pointers);
    const versions = [...new Set(Object.values(pointers))].filter((v) =>
      Boolean(v),
    );
    if (!names.length && !versions.length) return;

    const client = await this.factory.getClient();
    const multi = client.multi();
    const divPrefix = this.getDivisionString(division_id);

    for (const name of names) {
      multi.expire(`${divPrefix}:p:${name}`, SCOREBOARD_EXPIRE_TIME);
    }
    for (const v of versions) {
      for (const key of Object.values(this.getCacheKeys(division_id, v))) {
        multi.expire(key, SCOREBOARD_EXPIRE_TIME);
      }
    }
    await multi.exec();
  }

  async getChallengeSummary(
    division_id: number,
    version: number,
  ): Promise<Record<number, ChallengeSummary>> {
    if (!version) return {};
    return await this.getSummaryCoalescer.get(
      `${division_id}:${version}`,
      async () => {
        const keys = this.getCacheKeys(division_id, version);
        const client = await this.factory.getClient();
        const compressed = await client.get(
          client.commandOptions({ returnBuffers: true }),
          keys.csummary,
        );
        return compressed ? decode(await Decompress(compressed)) : {};
      },
    );
  }

  async getNotifiedSolves() {
    const client = await this.factory.getClient();
    return await client.get(
      client.commandOptions({ returnBuffers: true }),
      `${CACHE_NAMESPACE}:notified_solves`,
    );
  }

  async saveNotifiedSolves(data?: Buffer) {
    const client = await this.factory.getClient();
    if (!data) return await client.del(`${CACHE_NAMESPACE}:notified_solves`);
    return await client.set(`${CACHE_NAMESPACE}:notified_solves`, data);
  }

  private getDivisionString(division: number) {
    return `${CACHE_NAMESPACE}:d:${division}`;
  }

  private getCacheKeys(division: number, version: number) {
    const root = `${this.getDivisionString(division)}:v:${version}`;
    return {
      rank: `${root}:rank`,
      team: `${root}:team`,
      csolves: `${root}:csolves`,
      csummary: `${root}:csummary`,
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
        ...sortedTags.map((id) => `${CACHE_NAMESPACE}:tt:${id}`),
      ],
      [],
    );
  }
}
