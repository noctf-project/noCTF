import { ScoreboardEntry, Solve } from "@noctf/api/datatypes";
import { RedisClientFactory } from "../../clients/redis.ts";
import { decode, encode } from "cbor2";
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
    division: number,
    start: number,
    end: number,
  ): Promise<{ total: number; entries: ScoreboardEntry[] }> {
    return this.getScoreboardCoaleascer.get(
      `${division}:${start}:${end}`,
      async () => {
        const client = await this.factory.getClient();
        const keys = this.getCacheKeys(division);
        const [total, ranks] = await Promise.all([
          client.lLen(keys.rank),
          client.lRange(keys.rank, start, end),
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

  async getChallengeSolves(
    division: number,
    challenge: number,
  ): Promise<Solve[]> {
    return this.getChallengesCoalescer.get(
      `${division}:${challenge}`,
      async () => {
        const client = await this.factory.getClient();
        const keys = this.getCacheKeys(division);
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
    division: number,
    team: number,
  ): Promise<ScoreboardEntry | null> {
    return this.getTeamCoalescer.get(`${division}:${team}`, async () => {
      const client = await this.factory.getClient();
      const keys = this.getCacheKeys(division);
      const compressed = await client.hGet(
        client.commandOptions({ returnBuffers: true }),
        keys.team,
        team.toString(),
      );
      return compressed ? decode(await Decompress(compressed)) : null;
    });
  }

  async saveIndexed(
    division: number,
    scoreboard: ScoreboardEntry[],
    challenges: Map<number, ComputedChallengeScoreData>,
  ) {
    const client = await this.factory.getClient();
    const keys = this.getCacheKeys(division);

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
    multi.del(Object.values(keys));
    if (scoreboard.length)
      multi.rPush(
        keys.rank,
        scoreboard
          .filter((x) => !x.hidden)
          .map(({ team_id }) => team_id.toString()),
      );
    if (teams.length) multi.hSet(keys.team, teams);
    if (csolves.length) multi.hSet(keys.csolves, csolves);
    await multi.exec();
  }

  private getCacheKeys(division: number) {
    const root = `${this.namespace}:d:${division}`;
    return {
      rank: `${root}:rank`,
      team: `${root}:team`,
      csolves: `${root}:csolves`,
    };
  }
}
