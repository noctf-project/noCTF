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
import { createHash } from "node:crypto";

const SCOREBOARD_EXPIRE_TIME = 600;
const CACHE_NAMESPACE = "core:svc:score:data";
const TEAM_TAGS_KEY = `${CACHE_NAMESPACE}:tags`;

// Shared by the read scripts so preparation, invalidation, and reads cannot race.
const SCRIPT_PREPARE_RANK = `
local ranks_key = KEYS[4]
if ranks_key ~= KEYS[1] then
  local generation = redis.call('HGET', KEYS[2], 'generation')
  if not generation then return nil end
  ranks_key = ranks_key .. ':' .. generation
end
if ranks_key ~= KEYS[1] and redis.call('EXISTS', KEYS[1]) == 0 then
  redis.call('DEL', ranks_key)
  return nil
end
if ranks_key ~= KEYS[1] and redis.call('EXISTS', ranks_key) == 0 then
  for _, tag in ipairs(cjson.decode(ARGV[1])) do
    local members = redis.call('HGET', KEYS[2], tostring(tag))
    if members then
      for _, team in ipairs(cjson.decode(members)) do
        local score = redis.call('ZSCORE', KEYS[1], tostring(team))
        if score then
          redis.call('ZADD', ranks_key, score, tostring(team))
        end
      end
    end
  end
  redis.call('EXPIRE', ranks_key, 60)
  if redis.call('EXISTS', ranks_key) == 1 then
    redis.call('SADD', KEYS[3], ranks_key)
    redis.call('EXPIRE', KEYS[3], ${SCOREBOARD_EXPIRE_TIME})
  end
end`;

const SCRIPT_GET_SCOREBOARD = `${SCRIPT_PREPARE_RANK}
local teams_key = KEYS[5]
local exists = redis.call('EXISTS', ranks_key)
if exists == 0 then
  return nil
end

local teams = redis.call('ZRANGE', ranks_key, ARGV[2], ARGV[3])
local ret = {}
ret[1] = redis.call('ZCARD', ranks_key)
ret[3] = {}
if #teams > 0 then
  ret[2] = redis.call('HMGET', teams_key, unpack(teams))
  for i, team in ipairs(teams) do
    local score = redis.call('ZSCORE', ranks_key, team)
    ret[3][i] = redis.call('ZCOUNT', ranks_key, '-inf', '(' .. score) + 1
  end
else
  ret[2] = {}
end
return ret`;

const SCRIPT_GET_RANKS = `${SCRIPT_PREPARE_RANK}
return {redis.call('ZCARD', ranks_key), redis.call('ZRANGE', ranks_key, ARGV[2], ARGV[3])}`;

const SCRIPT_GET_TEAM_RANK = `${SCRIPT_PREPARE_RANK}
local score = redis.call('ZSCORE', ranks_key, ARGV[2])
if not score then return nil end
return redis.call('ZCOUNT', ranks_key, '-inf', '(' .. score) + 1`;

const SCRIPT_CLEAR_TAGGED_RANKS = `
for _, key in ipairs(redis.call('SMEMBERS', KEYS[1])) do
  redis.call('DEL', key)
end
redis.call('DEL', KEYS[1])`;

const SCRIPT_VALIDATE_SNAPSHOT = `
local required = redis.call('SMEMBERS', KEYS[1])
if #required == 0 then return 0 end
return redis.call('EXISTS', unpack(required)) == #required and 1 or 0`;

export class ScoreboardDataLoader {
  constructor(private readonly factory: RedisClientFactory) {}

  private readonly getScoreboardCoalescer = new Coleascer<{
    total: number;
    entries: ScoreboardEntry[];
  }>();
  private readonly getChallengesCoalescer = new Coleascer<Solve[]>();
  private readonly getSummaryCoalescer = new Coleascer<
    Record<number, ChallengeSummary>
  >();
  private readonly getTeamCoalescer = new Coleascer<ScoreboardEntry | null>();
  private readonly getTeamRankCoalescer = new Coleascer<number | null>();

  async saveTeamTags(teams: MinimalTeamInfo[]): Promise<void> {
    const tags = new Map<number, Set<number>>();
    for (const { id, tag_ids } of teams) {
      for (const tag of tag_ids) {
        const members = tags.get(tag) ?? new Set<number>();
        members.add(id);
        tags.set(tag, members);
      }
    }
    const membership = [...tags]
      .sort(([a], [b]) => a - b)
      .map(([tag, members]): [string, string] => [
        tag.toString(),
        JSON.stringify([...members].sort((a, b) => a - b)),
      ]);
    const generation = createHash("sha256")
      .update(JSON.stringify(membership))
      .digest("hex");
    const client = await this.factory.getClient();
    // Replace even empty membership atomically, without expiring it with snapshots.
    await client
      .multi()
      .del(TEAM_TAGS_KEY)
      .hSet(TEAM_TAGS_KEY, [...membership, ["generation", generation]])
      .exec();
  }

  async hasTeamTags(): Promise<boolean> {
    const client = await this.factory.getClient();
    return client.hExists(TEAM_TAGS_KEY, "generation");
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

    return this.getScoreboardCoalescer.get(
      `${division_id}:${version}:${start}:${end}:${sTags.join()}`,
      async () => {
        const keys = this.getCacheKeys(division_id, version);
        const result = await this.factory.executeScript<
          [number, Buffer[], number[]] | null
        >(
          SCRIPT_GET_SCOREBOARD,
          [...this.getRankKeys(division_id, version, sTags), keys.team],
          [JSON.stringify(sTags), start.toString(), end.toString()],
          true,
        );
        if (!result) return { total: 0, entries: [] };

        const entries = (
          await RunInParallelWithLimit(result[1], 8, async (x) => {
            return decode(await Decompress(x));
          })
        )
          .map(
            (x, i) =>
              x.status === "fulfilled" && {
                ...x.value,
                rank: result[2][i],
              },
          )
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
    if (!version) return [0, []];
    const sTags = [...new Set(tags)].sort();
    const result = await this.factory.executeScript<[number, string[]] | null>(
      SCRIPT_GET_RANKS,
      this.getRankKeys(division_id, version, sTags),
      [JSON.stringify(sTags), start.toString(), end.toString()],
    );
    return result ? [result[0], result[1].map(Number)] : [0, []];
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
    return this.getTeamRankCoalescer.get(
      `${division_id}:${version}:${team}:rank:${sTags.join()}`,
      async () => {
        return this.factory.executeScript<number | null>(
          SCRIPT_GET_TEAM_RANK,
          this.getRankKeys(division_id, version, sTags),
          [JSON.stringify(sTags), team.toString()],
        );
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
    ).map((x) => {
      if (x.status === "rejected") throw x.reason;
      return x.value;
    });

    const csolves = (
      await RunInParallelWithLimit(
        challenges.values(),
        8,
        async ({ challenge_id, solves }) => [
          challenge_id.toString(),
          await Compress(encode(solves)),
        ],
      )
    ).map((x) => {
      if (x.status === "rejected") throw x.reason;
      return x.value;
    }) as [string, Buffer][];

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
    // Replacement and derived-cache invalidation are one Redis transaction.
    multi.eval(SCRIPT_CLEAR_TAGGED_RANKS, { keys: [keys.ranktag] });
    multi.del(saved);
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
    // Redis omits empty collections, so only require indexes actually written.
    const required = [keys.csummary];
    if (visible.length) required.push(keys.rank);
    if (teams.length) required.push(keys.team);
    if (csolves.length) required.push(keys.csolves);
    multi.sAdd(keys.manifest, required);
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
      const keys = this.getCacheKeys(division_id, v);
      multi.eval(SCRIPT_CLEAR_TAGGED_RANKS, { keys: [keys.ranktag] });
      for (const key of Object.values(keys)) {
        multi.expire(key, ttl);
      }
    }
    await multi.exec();
  }

  async getPointers(
    division_id: number,
    names: string[],
    validate = false,
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
    if (validate && Object.keys(out).length) {
      const pointers = Object.entries(out);
      const multi = client.multi();
      for (const [, version] of pointers) {
        multi.eval(SCRIPT_VALIDATE_SNAPSHOT, {
          keys: [this.getCacheKeys(division_id, version).manifest],
        });
      }
      const exists = await multi.exec();
      pointers.forEach(([name], i) => {
        if (!exists[i]) delete out[name];
      });
    }
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
      manifest: `${root}:manifest`,
    };
  }

  private getRankKeys(division: number, version: number, sortedTags: number[]) {
    const keys = this.getCacheKeys(division, version);
    return [
      keys.rank,
      TEAM_TAGS_KEY,
      keys.ranktag,
      sortedTags.length ? `${keys.ranktag}:${sortedTags.join(",")}` : keys.rank,
    ];
  }
}
