import { ScoreboardEntry } from "@noctf/api/datatypes";
import { ServiceCradle } from "../../index.ts";
import { decode, encode } from "cbor2";

type Props = Pick<ServiceCradle, "redisClientFactory">;

export const TEAM_NAMESPACE = "core:svc:scoreboard_graph";
export class ScoreHistoryService {
  private readonly redisClientFactory;

  constructor({ redisClientFactory }: Props) {
    this.redisClientFactory = redisClientFactory;
  }

  async getTeam(id: number): Promise<[number, number][]> {
    const client = await this.redisClientFactory.getClient();
    // probably dumb
    const data = await client.lRange(
      client.commandOptions({ returnBuffers: true }),
      `${TEAM_NAMESPACE}:${id}`,
      0,
      Number.MAX_SAFE_INTEGER,
    );
    return data.map((x) => decode(x) as [number, number]);
  }

  async clearTeam(id: number) {
    const client = await this.redisClientFactory.getClient();
    await client.del(`${TEAM_NAMESPACE}:${id}`);
  }

  async commitDiff(entries: ScoreboardEntry[]) {
    const client = await this.redisClientFactory.getClient();
    const byTeam = new Map<number, Buffer[]>();
    for (const { team_id, score, timestamp } of entries) {
      let team = byTeam.get(team_id);
      if (!team) {
        team = [];
        byTeam.set(team_id, team);
      }
      const data = encode([timestamp.getTime(), score] as [number, number]);
      team.push(Buffer.from(data.buffer, data.byteOffset, data.byteLength));
    }
    await Promise.all(
      byTeam.entries().map(async ([id, scores]) => {
        await client.lPush(`${TEAM_NAMESPACE}:${id}`, scores);
      }),
    );
  }
}
