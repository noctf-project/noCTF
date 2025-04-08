import { ScoreboardEntry, ScoreboardVersionData, Solve } from "@noctf/api/datatypes";
import { RedisClientFactory } from "../../clients/redis.ts";
import { decode, encode } from "cbor-x";
import { ComputedChallengeScoreData } from "./calc.ts";
import { Compress, Decompress } from "../../util/message_compression.ts";
import { Coleascer } from "../../util/coleascer.ts";
import { RunInParallelWithLimit } from "../../util/semaphore.ts";

export class ScoreboardDataLoader {
  constructor(
    private readonly factory: RedisClientFactory,
    private readonly namespace: string,
  ) {}

  private readonly getScoreboardCoaleascer = new Coleascer();
  private readonly getChallengesCoalescer = new Coleascer();
  private readonly getTeamCoalescer = new Coleascer();

  async getScoreboard(
    pointer: string|number,
    division_id: number,
    start: number,
    end: number,
  ): Promise<{ total: number; entries: ScoreboardEntry[] }> {
    const version = await this.getVersionPointer(pointer, division_id);
    if (!version) return { total: 0, entries: [] };
    const keys = this.getCacheKeys(version, division_id);
    return this.getScoreboardCoaleascer.get(
      `${division_id}:${start}:${end}`,
      async () => {
        const client = await this.factory.getClient();
        const [total, ranks] = await Promise.all([
          client.zCard(keys.rank),
          client.zRange(keys.rank, start, end),
        ]);
        const compressed = await client.hmGet(
          client.commandOptions({ returnBuffers: true }),
          keys.team,
          ranks,
        );
        const entries = (
          await RunInParallelWithLimit(compressed, 8, async (x) => {
            return decode(await Decompress(x));
          })
        )
          .map((x) => x.status === "fulfilled" && x.value)
          .filter((x) => x) as ScoreboardEntry[];
        return { total, entries };
      },
    );
  }

  async getRanks(pointer: string | number, division_id: number, start: number, end: number) {
    const version = await this.getVersionPointer(pointer, division_id);
    if (!version) return [];
    const keys = this.getCacheKeys(version, division_id);
    return (
      await (await this.factory.getClient()).zRange(keys.rank, start, end)
    ).map((x) => parseInt(x));
  }

  async getChallengeSolves(
    pointer: string|number,
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
    return this.getTeamCoalescer.get(`${division_id}:${version}:${team}`, async () => {
      const client = await this.factory.getClient();
      const compressed = await client.hGet(
        client.commandOptions({ returnBuffers: true }),
        keys.team,
        team.toString(),
      );
      return compressed ? decode(await Decompress(compressed)) : null;
    });
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
    saved.push(...Object.values(keys));
    for (const key of saved) {
      multi.expire(key, 300);
    }
    await multi.exec();

    return {
      keys: saved,
      division_id,
      version
    };
  }
  
  async getVersionPointer(pointer: string|number, division_id: number) {
    if (typeof pointer === 'number') return pointer;
    const client = await this.factory.getClient();
    const result = await client.get(`${this.getDivisionString(division_id)}:p:${pointer}`);
    return result ? (JSON.parse(result) as ScoreboardVersionData).version : null;
  }

  async saveVersionPointer(data: ScoreboardVersionData) {
    const client = await this.factory.getClient();
    await client.set(`${this.getDivisionString(data.division_id)}:p:${data.version}`, JSON.stringify(data));
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
    };
  }
}
