import { Type } from "@sinclair/typebox";
import { Ticket } from "../schema/datatypes.ts";
import { ServiceCradle } from "@noctf/server-core";
import { TicketConfig } from "../schema/config.ts";
import ky, { KyInstance } from "ky";
import {
  APIThreadChannel,
  ChannelType,
  RESTPatchAPIChannelJSONBody,
  RESTPostAPIChannelMessageJSONBody,
  RESTPostAPIChannelThreadsJSONBody,
} from "discord-api-types/v10";
import { TicketService } from "../service.ts";
import { UnrecoverableError } from "@noctf/server-core/services/event_bus";

export const DiscordProviderData = Type.Object({
  channel: Type.String(),
  thread: Type.String(),
});

export enum EmbedColor {
  "Opened" = 0x57f287,
  // eslint-disable-next-line @typescript-eslint/no-duplicate-enum-values
  "Re-Opened" = 0x57f287,
  "Closed" = 0xed4245,
}

export const API_ENDPOINT = "https://discord.com/api/v10";

const USER_REGEX = /^(user|discord):(\d+)$/;

type Props = Pick<
  ServiceCradle,
  "configService" | "identityService" | "teamService" | "logger"
> & { ticketService: TicketService };
export class DiscordProvider {
  private readonly configService;
  private readonly teamService;
  private readonly identityService;
  private readonly ticketService;
  private readonly logger;

  private client: KyInstance;
  private clientConfigVersion: number;

  constructor({
    configService,
    identityService,
    teamService,
    logger,
    ticketService,
  }: Props) {
    this.configService = configService;
    this.identityService = identityService;
    this.teamService = teamService;
    this.ticketService = ticketService;
    this.logger = logger;
  }

  private async getConfig() {
    const {
      version,
      value: { discord },
    } = await this.configService.get<TicketConfig>(TicketConfig.$id);
    if (!discord) {
      // throw untryable error
      throw new Error("discord config is not present");
    }
    return { version, ...discord };
  }

  private async getClient() {
    const { version, bot_token } = await this.getConfig();
    if (this.clientConfigVersion === version) {
      return this.client;
    }
    this.client = ky.create({
      prefixUrl: API_ENDPOINT,
      headers: {
        authorization: `Bot ${bot_token}`,
      },
      retry: {
        limit: 3,
        backoffLimit: 8000,
        statusCodes: [408, 429, 502, 503, 504],
        afterStatusCodes: [429, 503],
        methods: ["get", "post", "put", "head", "delete", "patch", "options"],
      },
    });
    this.clientConfigVersion = version;
    return this.client;
  }

  private async addUsers(channelId: string, userIds: number[]) {
    const client = await this.getClient();
    for (const id of userIds) {
      const providerId = (
        await this.identityService.getProviderForUser("discord", id)
      )?.provider_id;
      if (!providerId) {
        continue;
      }
      await client.put(`channels/${channelId}/thread-members/${providerId}`);
    }
  }

  private async postNotification(
    channelId: string,
    actor: string,
    ticket: Ticket,
    status: keyof typeof EmbedColor,
  ) {
    const client = await this.getClient();
    const requesterType = ticket.team_id ? "Team" : "User";
    const requesterId = ticket.team_id || ticket.user_id;
    await client.post(`channels/${channelId}/messages`, {
      json: {
        embeds: [
          {
            title: `Ticket ${status}`,
            color: EmbedColor[status],
            fields: [
              {
                name: "Category",
                value: ticket.category,
                inline: true,
              },
              {
                name: "Item",
                value: ticket.item,
                inline: true,
              },
              {
                name: "ID",
                value: "[1](https://ctf.sk8boarding.dog/ticket/1)",
                inline: true,
              },
              { name: "", value: "" },
              {
                name: "Requester Type",
                value: requesterType,
                inline: true,
              },
              {
                name: "Requester ID",
                value: requesterId,
                inline: true,
              },
              {
                name: "Actor",
                value: actor,
                inline: true,
              },
              { name: "", value: "" },
              {
                name: "Thread",
                value: `<#${ticket.provider_id}>`,
                inline: true,
              },
            ].filter((x) => x),
          },
        ],
      } as RESTPostAPIChannelMessageJSONBody,
    });
  }

  async open(actor: string, lease: string, ticket: Ticket) {
    const { notifications_channel_id, tickets_channel_id } =
      await this.getConfig();
    const client = await this.getClient();
    try {
      await this.ticketService.renewStateLease(ticket.id, lease);
    } catch (e) {
      throw new UnrecoverableError("Could not renew state lease");
    }

    const newTicket = !ticket.provider_id;
    if (newTicket) {
      const res = await client.post<APIThreadChannel>(
        `channels/${tickets_channel_id}/threads`,
        {
          json: {
            name: `ticket-${ticket.id}`,
            type: ChannelType.PrivateThread,
            invitable: false,
            auto_archive_duration: 60,
          } as RESTPostAPIChannelThreadsJSONBody,
        },
      );
      const json = await res.json();
      ticket.provider_id = json.id;
      await this.ticketService.setProviderId(ticket.id, "discord", json.id);
    } else {
      await client.patch<APIThreadChannel>(`channels/${ticket.provider_id}`, {
        json: {
          archived: false,
          locked: false,
        } as RESTPatchAPIChannelJSONBody,
      });
    }
    const match = actor.match(USER_REGEX);
    const actingDiscordId = await this.getActingDiscordId(actor);
    // TODO: commit to db here
    const actorStr = actingDiscordId ? `<@${actingDiscordId}>` : actor;
    const state = newTicket ? "Opened" : "Re-Opened";
    await this.postNotification(
      notifications_channel_id,
      actorStr,
      ticket,
      state,
    );
    await this.postNotification(ticket.provider_id, actorStr, ticket, state);
    if (newTicket) {
      if (ticket.user_id) {
        const members = [ticket.user_id];
        await this.addUsers(ticket.provider_id, members);
      } else if (ticket.team_id) {
        const members = (await this.teamService.getMembers(ticket.team_id)).map(
          ({ user_id }) => user_id,
        );
        await this.addUsers(ticket.provider_id, members);
      }
    }
    await this.ticketService.dropStateLease(ticket.id, lease);
  }

  async close(actor: string, lease: string, ticket: Ticket) {
    const { notifications_channel_id } = await this.getConfig();
    const client = await this.getClient();
    try {
      await this.ticketService.renewStateLease(ticket.id, lease);
    } catch (e) {
      throw new UnrecoverableError("Could not renew state lease");
    }
    const match = actor.match(USER_REGEX);
    const actingDiscordId = await this.getActingDiscordId(actor);
    await this.postNotification(
      ticket.provider_id,
      actingDiscordId ? `<@${actingDiscordId}>` : actor,
      ticket,
      "Closed",
    );
    await client.patch<APIThreadChannel>(`channels/${ticket.provider_id}`, {
      json: {
        archived: true,
        locked: true,
      } as RESTPatchAPIChannelJSONBody,
    });
    const actingUserId = (
      await this.identityService.getIdentityForProvider(
        "discord",
        actingDiscordId,
      )
    )?.user_id;
    this.logger.debug(
      { user_id: actingUserId, discord_id: actingDiscordId },
      "Matched Discord ID with existing user",
    );
    // TODO: commit to db here
    await this.postNotification(
      notifications_channel_id,
      actingDiscordId ? `<@${actingDiscordId}>` : actor,
      ticket,
      "Closed",
    );
    await this.ticketService.dropStateLease(ticket.id, lease);
  }

  private async getActingDiscordId(actor: string) {
    const match = actor.match(USER_REGEX);
    if (match && match[1] === "user") {
      return (
        await this.identityService.getProviderForUser(
          "discord",
          parseInt(match[2]),
        )
      )?.provider_id;
    } else if (match && match[1] === "discord") {
      return match[2];
    }
  }
}
