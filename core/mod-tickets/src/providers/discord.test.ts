import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { mock } from "vitest-mock-extended";
import { DiscordProvider, EmbedColor } from "./discord.ts";
import type { ConfigService } from "@noctf/server-core/services/config";
import type { IdentityService } from "@noctf/server-core/services/identity";
import type { TeamService } from "@noctf/server-core/services/team";
import type { Logger } from "@noctf/server-core/types/primitives";
import type { TicketConfig } from "../schema/config.ts";
import type { KyResponse } from "ky";
import ky from "ky";
import type {
  APIThreadChannel,
  APIThreadMember,
  RESTGetAPIChannelThreadMembersResult,
  RESTPostAPIChannelMessageResult,
} from "discord-api-types/v10";
import { ChannelType, ThreadMemberFlags } from "discord-api-types/v10";
import type { TicketService } from "../service.ts";
import type { Ticket } from "../schema/datatypes.ts";
import { TicketState } from "../schema/datatypes.ts";

vi.mock("ky");
const mockKy = vi.mocked(ky, true);
const configService = mock<ConfigService>();
const identityService = mock<IdentityService>();
const teamService = mock<TeamService>();
const ticketService = mock<TicketService>();
const logger = mock<Logger>();

const date = new Date("1970-01-01T00:00:00Z");

describe("Discord Tickets Provider", async () => {
  beforeEach(() => {
    mockKy.create.mockReturnThis();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  const mockTicket = (a: Partial<Ticket> = {}): Ticket => ({
    id: 42,
    state: a.state || TicketState.Created,
    category: "challenge",
    item: "pwn-hello",
    assignee_id: null,
    provider: "discord",
    provider_id: a.provider_id || null,
    provider_metadata: a.provider_metadata || null,
    team_id: a.team_id || null,
    user_id: a.user_id || null,
    created_at: new Date("1970-01-01T00:00:00Z"),
  });

  test("Fails to open if discord config is not present", async () => {
    const provider = new DiscordProvider({
      configService,
      identityService,
      teamService,
      ticketService,
      logger,
    });
    configService.get.mockResolvedValue({ version: 1, value: {} });
    await expect(() => provider.open(mockTicket())).rejects.toThrowError(
      "discord config is not present",
    );
  });

  test("Fails to close if discord config is not present", async () => {
    const provider = new DiscordProvider({
      configService,
      identityService,
      teamService,
      ticketService,
      logger,
    });
    configService.get.mockResolvedValue({ version: 1, value: {} });
    await expect(() => provider.open(mockTicket())).rejects.toThrowError(
      "discord config is not present",
    );
  });

  test("Open a new ticket on behalf of a team", async () => {
    const provider = new DiscordProvider({
      configService,
      identityService,
      teamService,
      ticketService,
      logger,
    });
    configService.get.mockResolvedValue({
      version: 1,
      value: {
        discord: {
          bot_token: "bot-token",
          tickets_channel_id: "0000",
          notifications_channel_id: "1111",
        },
      } as TicketConfig,
    });
    const createThread = mock<KyResponse<APIThreadChannel>>();
    createThread.json.mockResolvedValue({
      id: "2222",
    });
    const postNotification =
      mock<KyResponse<RESTPostAPIChannelMessageResult>>();
    postNotification.json.mockResolvedValue({
      id: "3333",
    });
    mockKy.post
      .mockResolvedValueOnce(createThread)
      .mockResolvedValueOnce(postNotification)
      .mockResolvedValueOnce(postNotification);

    teamService.listMembers.mockResolvedValue([
      { user_id: 1, role: "member" },
      { user_id: 2, role: "member" },
      { user_id: 3, role: "member" },
    ]);
    identityService.getProviderForUser.mockImplementation((user_id, provider) =>
      Promise.resolve({
        provider_id: (user_id * 10).toString(),
        provider,
        user_id,
        created_at: date,
        secret_data: null,
      }),
    );
    await provider.open(mockTicket({ team_id: 1 }));
    expect(mockKy.post).toHaveBeenCalledTimes(3);
    expect(mockKy.post).toHaveBeenCalledWith("channels/0000/threads", {
      json: {
        name: "ticket-42",
        type: ChannelType.PrivateThread,
        invitable: false,
        auto_archive_duration: 60,
      },
    });
    const embed = {
      title: "Ticket Opened",
      color: EmbedColor.Opened,
      fields: expect.arrayContaining([
        {
          name: "Category",
          value: "challenge",
          inline: true,
        },
        {
          name: "Item",
          value: "pwn-hello",
          inline: true,
        },
        {
          name: "Requester Type",
          value: "Team",
          inline: true,
        },
        {
          name: "Assignee",
          value: "nobody",
          inline: true,
        },
      ]),
    };
    expect(mockKy.post).toHaveBeenCalledWith("channels/1111/messages", {
      json: {
        embeds: [embed],
      },
    });
    expect(mockKy.post).toHaveBeenCalledWith("channels/2222/messages", {
      json: {
        embeds: [embed],
      },
    });
    expect(mockKy.put).toHaveBeenCalledTimes(3);
    expect(mockKy.put).toHaveBeenCalledWith("channels/2222/thread-members/10");
    expect(mockKy.put).toHaveBeenCalledWith("channels/2222/thread-members/20");
    expect(mockKy.put).toHaveBeenCalledWith("channels/2222/thread-members/30");
    expect(ticketService.update).toBeCalledWith(42, {
      state: TicketState.Open,
      provider_id: "2222",
      assignee_id: null,
    });
    expect(ticketService.update).toBeCalledWith(42, {
      provider_metadata: { notification_id: "3333" },
    });
  });

  test("Open a new ticket on behalf of a user", async () => {
    const provider = new DiscordProvider({
      configService,
      identityService,
      teamService,
      ticketService,
      logger,
    });
    configService.get.mockResolvedValue({
      version: 1,
      value: {
        discord: {
          bot_token: "bot-token",
          tickets_channel_id: "0000",
          notifications_channel_id: "1111",
        },
      } as TicketConfig,
    });

    const createThread = mock<KyResponse<APIThreadChannel>>();
    createThread.json.mockResolvedValue({
      id: "2222",
    });
    const postNotification =
      mock<KyResponse<RESTPostAPIChannelMessageResult>>();
    postNotification.json.mockResolvedValue({
      id: "3333",
    });
    mockKy.post
      .mockResolvedValueOnce(createThread)
      .mockResolvedValueOnce(postNotification)
      .mockResolvedValueOnce(postNotification);
    const apiThreadMembers: APIThreadMember[] = [];
    const threadMembersResponse =
      mock<KyResponse<RESTGetAPIChannelThreadMembersResult>>();
    threadMembersResponse.json.mockResolvedValueOnce(apiThreadMembers);
    mockKy.get.mockResolvedValueOnce(threadMembersResponse);
    vi.mocked(identityService).getProviderForUser.mockImplementation(
      (user_id, provider) =>
        Promise.resolve({
          provider_id: (user_id * 10).toString(),
          provider,
          user_id,
          created_at: date,
          secret_data: null,
        }),
    );

    await provider.open(mockTicket({ user_id: 1 }));
    expect(mockKy.post).toHaveBeenCalledTimes(3);
    expect(mockKy.post).toHaveBeenCalledWith("channels/0000/threads", {
      json: {
        name: "ticket-42",
        type: ChannelType.PrivateThread,
        invitable: false,
        auto_archive_duration: 60,
      },
    });
    const embed = {
      title: "Ticket Opened",
      color: EmbedColor.Opened,
      fields: expect.arrayContaining([
        {
          name: "Category",
          value: "challenge",
          inline: true,
        },
        {
          name: "Item",
          value: "pwn-hello",
          inline: true,
        },
        {
          name: "Requester Type",
          value: "User",
          inline: true,
        },
        {
          name: "Assignee",
          value: "nobody",
          inline: true,
        },
      ]),
    };
    expect(mockKy.post).toHaveBeenCalledWith("channels/1111/messages", {
      json: {
        embeds: [embed],
      },
    });
    expect(mockKy.post).toHaveBeenCalledWith("channels/2222/messages", {
      json: {
        embeds: [embed],
      },
    });
    expect(mockKy.put).toHaveBeenCalledTimes(1);
    expect(mockKy.put).toHaveBeenCalledWith("channels/2222/thread-members/10");
    expect(ticketService.update).toBeCalledWith(42, {
      state: TicketState.Open,
      provider_id: "2222",
      assignee_id: null,
    });
    expect(ticketService.update).toBeCalledWith(42, {
      provider_metadata: { notification_id: "3333" },
    });
  });

  test("Open a new ticket for a user without a linked discord account.", async () => {
    const provider = new DiscordProvider({
      configService,
      identityService,
      teamService,
      ticketService,
      logger,
    });
    configService.get.mockResolvedValue({
      version: 1,
      value: {
        discord: {
          bot_token: "bot-token",
          tickets_channel_id: "0000",
          notifications_channel_id: "1111",
        },
      } as TicketConfig,
    });

    const createThread = mock<KyResponse<APIThreadChannel>>();
    createThread.json.mockResolvedValue({
      id: "2222",
    });
    const postNotification =
      mock<KyResponse<RESTPostAPIChannelMessageResult>>();
    postNotification.json.mockResolvedValue({
      id: "3333",
    });
    mockKy.post
      .mockResolvedValueOnce(createThread)
      .mockResolvedValueOnce(postNotification)
      .mockResolvedValueOnce(postNotification);
    const threadMembersResponse =
      mock<KyResponse<RESTGetAPIChannelThreadMembersResult>>();
    threadMembersResponse.json.mockResolvedValueOnce([]);
    mockKy.get.mockResolvedValueOnce(threadMembersResponse);

    await provider.open(mockTicket({ user_id: 1 }));
    expect(mockKy.post).toHaveBeenCalledTimes(3);
    expect(mockKy.post).toHaveBeenCalledWith("channels/0000/threads", {
      json: {
        name: "ticket-42",
        type: ChannelType.PrivateThread,
        invitable: false,
        auto_archive_duration: 60,
      },
    });
    const embed = {
      title: "Ticket Opened",
      color: EmbedColor.Opened,
      fields: expect.arrayContaining([
        {
          name: "Category",
          value: "challenge",
          inline: true,
        },
        {
          name: "Item",
          value: "pwn-hello",
          inline: true,
        },
        {
          name: "Requester Type",
          value: "User",
          inline: true,
        },
        {
          name: "Assignee",
          value: "nobody",
          inline: true,
        },
      ]),
    };
    expect(mockKy.post).toHaveBeenCalledWith("channels/1111/messages", {
      json: {
        embeds: [embed],
      },
    });
    expect(mockKy.post).toHaveBeenCalledWith("channels/2222/messages", {
      json: {
        embeds: [embed],
      },
    });
    expect(ticketService.update).toBeCalledWith(42, {
      state: TicketState.Open,
      assignee_id: null,
      provider_id: "2222",
    });
    expect(ticketService.update).toBeCalledWith(42, {
      provider_metadata: { notification_id: "3333" },
    });
  });

  test("Re-open an existing ticket", async () => {
    const provider = new DiscordProvider({
      configService,
      identityService,
      teamService,
      ticketService,
      logger,
    });
    configService.get.mockResolvedValue({
      version: 1,
      value: {
        discord: {
          bot_token: "bot-token",
          tickets_channel_id: "0000",
          notifications_channel_id: "1111",
        },
      } as TicketConfig,
    });
    vi.mocked(identityService).getProviderForUser.mockImplementation(
      (user_id, provider) =>
        Promise.resolve({
          provider_id: (user_id * 10).toString(),
          provider,
          user_id,
          created_at: date,
          secret_data: null,
        }),
    );
    const apiThreadMembers: APIThreadMember[] = [
      {
        id: "10",
        join_timestamp: "0",
        flags: ThreadMemberFlags.NoMessages,
      },
      {
        id: "20",
        join_timestamp: "0",
        flags: ThreadMemberFlags.NoMessages,
      },
    ];

    const createThread = mock<KyResponse<APIThreadChannel>>();
    createThread.json.mockResolvedValue({
      id: "2222",
    });
    const postNotification =
      mock<KyResponse<RESTPostAPIChannelMessageResult>>();
    postNotification.json.mockResolvedValue({
      id: "3333",
    });
    mockKy.post
      .mockResolvedValueOnce(createThread)
      .mockResolvedValueOnce(postNotification)
      .mockResolvedValueOnce(postNotification);
    const threadMembersResponse =
      mock<KyResponse<RESTGetAPIChannelThreadMembersResult>>();
    threadMembersResponse.json.mockResolvedValueOnce(apiThreadMembers);
    mockKy.get.mockResolvedValueOnce(threadMembersResponse);

    vi.mocked(teamService).listMembers.mockResolvedValue([
      { user_id: 1, role: "member" },
      { user_id: 2, role: "member" },
      { user_id: 3, role: "member" },
    ]);
    await provider.open(
      mockTicket({
        state: TicketState.Closed,
        provider_id: "2222",
        team_id: 1,
      }),
    );
    expect(mockKy.patch).toHaveBeenCalledWith("channels/2222", {
      json: {
        locked: false,
        archived: false,
      },
    });
    expect(mockKy.post).toHaveBeenCalledTimes(2);
    const embed = {
      title: "Ticket Re-Opened",
      color: EmbedColor["Re-Opened"],
      fields: expect.arrayContaining([
        {
          name: "Category",
          value: "challenge",
          inline: true,
        },
        {
          name: "Item",
          value: "pwn-hello",
          inline: true,
        },
        {
          name: "Requester Type",
          value: "Team",
          inline: true,
        },
        {
          name: "Assignee",
          value: "nobody",
          inline: true,
        },
      ]),
    };
    expect(mockKy.post).toHaveBeenCalledWith("channels/1111/messages", {
      json: {
        embeds: [embed],
      },
    });
    expect(mockKy.post).toHaveBeenCalledWith("channels/2222/messages", {
      json: {
        embeds: [embed],
      },
    });
    expect(mockKy.put).toHaveBeenCalledTimes(1);
    expect(mockKy.put).toHaveBeenCalledWith("channels/2222/thread-members/30");
    expect(ticketService.update).toBeCalledWith(42, {
      state: TicketState.Open,
    });
  });

  test("Closing a ticket", async () => {
    const provider = new DiscordProvider({
      configService,
      identityService,
      teamService,
      ticketService,
      logger,
    });
    configService.get.mockResolvedValue({
      version: 1,
      value: {
        discord: {
          bot_token: "bot-token",
          tickets_channel_id: "0000",
          notifications_channel_id: "1111",
        },
      } as TicketConfig,
    });
    vi.mocked(identityService).getIdentityForProvider.mockImplementation(
      (name, id) =>
        Promise.resolve({
          provider_id: id,
          provider: name,
          user_id: Math.floor(parseInt(id) / 10),
          created_at: date,
          secret_data: null,
        }),
    );

    const createThread = mock<KyResponse<APIThreadChannel>>();
    createThread.json.mockResolvedValue({
      id: "2222",
    });
    const postNotification =
      mock<KyResponse<RESTPostAPIChannelMessageResult>>();
    postNotification.json.mockResolvedValue({
      id: "3333",
    });
    mockKy.post
      .mockResolvedValueOnce(createThread)
      .mockResolvedValueOnce(postNotification);

    await provider.close(
      mockTicket({
        team_id: 1,
        provider_id: "2222",
        provider_metadata: { notification_id: "3333" },
      }),
    );

    expect(mockKy.patch).toHaveBeenCalledWith("channels/2222", {
      json: {
        locked: true,
        archived: true,
      },
    });
    const embed = {
      title: "Ticket Closed",
      color: EmbedColor.Closed,
      fields: expect.arrayContaining([
        {
          name: "Category",
          value: "challenge",
          inline: true,
        },
        {
          name: "Item",
          value: "pwn-hello",
          inline: true,
        },
        {
          name: "Requester Type",
          value: "Team",
          inline: true,
        },
        {
          name: "Assignee",
          value: "nobody",
          inline: true,
        },
      ]),
    };
    expect(mockKy.patch).toHaveBeenCalledWith("channels/1111/messages/3333", {
      json: {
        embeds: [embed],
      },
    });
    expect(mockKy.post).toHaveBeenCalledWith("channels/2222/messages", {
      json: {
        embeds: [embed],
      },
    });
    expect(ticketService.update).toBeCalledWith(42, {
      state: TicketState.Closed,
    });
  });
});
