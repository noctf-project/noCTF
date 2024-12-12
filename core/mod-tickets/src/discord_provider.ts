import { Type } from "@sinclair/typebox";
import { Ticket } from "./schema/datatypes.ts";
import { ServiceCradle } from "@noctf/server-core";
import { TicketConfig } from "./schema/config.ts";
import ky from "ky";

export const DiscordProviderData = Type.Object({
  channel: Type.String(),
  thread: Type.String(),
});

export const API_ENDPOINT = "https://discord.com/api/v10";

type Props = Pick<ServiceCradle, "configService"|"identityService" | "teamService">;
export class DiscordProvider {
  private readonly configService;
  private readonly teamService;
  private readonly identityService;

  constructor({ configService, identityService, teamService }: Props) {
    this.configService = configService;
    this.identityService = identityService;
    this.teamService = teamService;
  }

  async getConfig() {
    const {
      value: { discord },
    } = await this.configService.get<TicketConfig>(TicketConfig.$id);
    if (!discord) {
      // throw untryable error
      throw new Error("discord config not present");
    }
    return discord;
  }

  async getClient() {
    return ky.create({
      prefixUrl: API_ENDPOINT,
      headers: {
        authorization: `Bot ${(await this.getConfig()).token}`,
      }
    });
  }

  private async addUsers(channelId: string, userIds: number[]) {
    const client = await this.getClient();
    for (const id of userIds) {
      const providerId = await this.identityService.getProviderIdForUser("discord", id);
      if (!providerId) {
        continue;
      }
      await client.put(
        `channels/${channelId}/thread-members/${providerId}`,
      );
    }
  }

  async open(ticket: Ticket) {
    const { token, tickets_channel_id, notifications_channel_id } =
      await this.getConfig();
    
    const client = await this.getClient();
    const res = await client.post(`channels/${tickets_channel_id}/threads`,
      {
        json: {
          name: `test-ticket-3`,
          type: 12, // Private thread
          invitable: false,
        },
      },
    );
    const json: { id: string } = await res.json();
    await client.post(
      `channels/${notifications_channel_id}/messages`,
      {
        json: {
          content: `Ticket <#${json.id}> opened`,
        },
      },
    );
    // TODO: prevent people from injecting messages into the description
    await client.post(
      `channels/${json.id}/messages`,
      {
        json: {
          content: `Description: ${ticket.description}`,
        },
      },
    );
    if (ticket.user_id) {
      const members = [ticket.user_id];
      await this.addUsers(json.id, members);
    } else if (ticket.team_id) {
      const members = (await this.teamService.getMembers(ticket.team_id))
        .map(({ user_id }) => user_id);
      await this.addUsers(json.id, members);

    }
  }
}

