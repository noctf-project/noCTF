import { Type } from "@sinclair/typebox";
import type { Ticket } from "../schema/datatypes.ts";
import { TicketState } from "../schema/datatypes.ts";
import type { ServiceCradle } from "@noctf/server-core";
import { TicketConfig } from "../schema/config.ts";
import type { KyInstance } from "ky";
import ky from "ky";
import type {
  APIEmbed,
  APIThreadChannel,
  RESTGetAPIChannelThreadMembersResult,
  RESTPatchAPIChannelJSONBody,
  RESTPatchAPIChannelMessageJSONBody,
  RESTPostAPIChannelMessageJSONBody,
  RESTPostAPIChannelMessageResult,
  RESTPostAPIChannelThreadsJSONBody,
} from "discord-api-types/v10";
import { ChannelType } from "discord-api-types/v10";
import type { TicketService } from "../service.ts";
import { EventBusNonRetryableError } from "@noctf/server-core/services/event_bus";

export const DiscordProviderData = Type.Object({
  channel: Type.String(),
  thread: Type.String(),
});

export enum EmbedColor {
  "Opened" = 0x57f287,
  // eslint-disable-next-line @typescript-eslint/no-duplicate-enum-values
  "Re-Opened" = 0x57f287,
  "Assigned" = 0xf1c40f,
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
    } = await this.configService.get(TicketConfig);
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
      keepalive: true,
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

  private async addUsers(channelId: string, userIds: number[], isNew: boolean) {
    const client = await this.getClient();
    const current = new Set<string>();
    if (!isNew) {
      const limit = 100;
      let after = "";
      while (true) {
        const searchParams: Record<string, number | string> = { limit };
        if (after) {
          searchParams.after = after;
        }
        const res = await client.get<RESTGetAPIChannelThreadMembersResult>(
          `channels/${channelId}/thread-members`,
          {
            searchParams,
          },
        );
        const members = await res.json();
        for (const member of members) {
          current.add(member.id);
        }
        if (members.length < limit) {
          break;
        }
        after = members[members.length - 1].id;
      }
    }
    for (const id of userIds) {
      const providerId = (
        await this.identityService.getProviderForUser(id, "discord")
      )?.provider_id;
      if (!providerId || current.has(providerId)) {
        continue;
      }
      await client.put(`channels/${channelId}/thread-members/${providerId}`);
    }
  }

  private async postNotification(
    channelId: string,
    status: keyof typeof EmbedColor,
    { ticket, assignee }: { ticket: Ticket; assignee?: string },
    messageId?: string,
  ) {
    const client = await this.getClient();
    const requesterType = ticket.team_id ? "Team" : "User";
    const requesterId = (ticket.team_id || ticket.user_id).toString();
    const embed: APIEmbed = {
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
          value: `[${ticket.id}](https://ctf.sk8boarding.dog/ticket/${ticket.id})`,
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
          value: requesterId.toString(),
          inline: true,
        },
        {
          name: "Assignee",
          value: assignee || "nobody",
          inline: true,
        },
        { name: "", value: "" },
        {
          name: "Thread",
          value: `<#${ticket.provider_id}>`,
          inline: true,
        },
      ].filter((x) => x),
    };
    if (messageId) {
      try {
        await client.patch(`channels/${channelId}/messages/${messageId}`, {
          json: {
            embeds: [embed],
          } as RESTPatchAPIChannelMessageJSONBody,
        });
      } catch (err) {
        this.logger.error(err, "Could not update message, ignoring error.");
      }
    } else {
      const result = await client.post<RESTPostAPIChannelMessageResult>(
        `channels/${channelId}/messages`,
        {
          json: {
            embeds: [embed],
          } as RESTPostAPIChannelMessageJSONBody,
        },
      );
      const data = await result.json();
      return data.id;
    }
  }

  async open(ticket: Ticket) {
    const { notifications_channel_id, tickets_channel_id } =
      await this.getConfig();
    const client = await this.getClient();

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
      await this.ticketService.update(ticket.id, {
        provider_id: json.id,
        assignee_id: null,
        state: TicketState.Open,
      });
      ticket.assignee_id = null;
    } else {
      await client.patch<APIThreadChannel>(`channels/${ticket.provider_id}`, {
        json: {
          archived: false,
          locked: false,
        } as RESTPatchAPIChannelJSONBody,
      });
      await this.ticketService.update(ticket.id, {
        state: TicketState.Open,
      });
    }
    // TODO: commit log to db here
    const state = newTicket ? "Opened" : "Re-Opened";
    const notificationId = await this.postNotification(
      notifications_channel_id,
      state,
      {
        ticket,
      },
    );
    await this.ticketService.update(ticket.id, {
      provider_metadata: {
        ...ticket.provider_metadata,
        notification_id: notificationId,
      },
    });
    await this.postNotification(ticket.provider_id, state, {
      ticket,
    });

    if (ticket.user_id) {
      const members = [ticket.user_id];
      await this.addUsers(ticket.provider_id, members, newTicket);
    } else if (ticket.team_id) {
      const members = (await this.teamService.listMembers(ticket.team_id)).map(
        ({ user_id }) => user_id,
      );
      await this.addUsers(ticket.provider_id, members, newTicket);
    }
  }

  async assign(ticket: Ticket) {
    const { notifications_channel_id } = await this.getConfig();

    await this.postNotification(
      notifications_channel_id,
      ticket.state === "open" ? "Assigned" : "Closed",
      {
        assignee: await this.formatUserIdForDiscord(ticket.assignee_id),
        ticket,
      },
      ticket.provider_metadata.notification_id,
    );
  }

  async close(ticket: Ticket) {
    if (!ticket.provider_id) {
      throw new EventBusNonRetryableError(
        "Ticket has no provider ID, cannot be closed",
      );
    }
    const { notifications_channel_id } = await this.getConfig();
    const client = await this.getClient();
    const assignee = await this.formatUserIdForDiscord(ticket.assignee_id);
    await this.postNotification(ticket.provider_id, "Closed", {
      assignee,
      ticket,
    });
    await client.patch<APIThreadChannel>(`channels/${ticket.provider_id}`, {
      json: {
        archived: true,
        locked: true,
      } as RESTPatchAPIChannelJSONBody,
    });
    await this.ticketService.update(ticket.id, {
      state: TicketState.Closed,
    });
    // TODO: commit to db here
    await this.postNotification(
      notifications_channel_id,
      "Closed",
      {
        assignee,
        ticket,
      },
      ticket.provider_metadata?.notification_id,
    );
  }

  private async formatUserIdForDiscord(actor: string | number) {
    if (!actor) {
      return null;
    }
    const id = await this.getActingDiscordId(actor);
    if (id) {
      return `<@${id}>`;
    }
    return actor.toString();
  }

  private async getActingDiscordId(actor: string | number) {
    if (typeof actor === "number") {
      return (await this.identityService.getProviderForUser(actor, "discord"))
        ?.provider_id;
    }
    const match = actor.match(USER_REGEX);
    if (match && match[1] === "user") {
      return (
        await this.identityService.getProviderForUser(
          parseInt(match[2]),
          "discord",
        )
      )?.provider_id;
    } else if (match && match[1] === "discord") {
      return match[2];
    }
  }
}
