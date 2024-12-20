import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { mock } from "vitest-mock-extended";
import { DiscordProvider, EmbedColor } from "./discord.ts";
import { ConfigService } from "@noctf/server-core/services/config";
import { IdentityService } from "@noctf/server-core/services/identity";
import { TeamService } from "@noctf/server-core/services/team";
import { Logger } from "@noctf/server-core/types/primitives";
import { TicketConfig } from "../schema/config.ts";
import ky, { KyResponse } from "ky";
import {
  APIThreadChannel,
  APIThreadMember,
  ChannelType,
  ThreadMemberFlags,
} from "discord-api-types/v10";
import { TicketService } from "../service.ts";
import { TicketState } from "../schema/datatypes.ts";

vi.mock("ky");
const mockKy = vi.mocked(ky, true);
const mockKyResponse = mock<KyResponse>();
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

  test("Fails to open if discord config is not present", async () => {
    const provider = new DiscordProvider({
      configService,
      identityService,
      teamService,
      ticketService,
      logger,
    });
    configService.get.mockResolvedValue({ version: 1, value: {} });
    await expect(() =>
      provider.open("user:1", "lease", {
        id: 1,
        state: TicketState.Created,
        category: "challenge",
        item: "pwn-hello",
        provider: "discord",
        provider_id: null,
        created_at: new Date("1970-01-01T00:00:00Z"),
      }),
    ).rejects.toThrowError("discord config is not present");
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
    await expect(() =>
      provider.open("user:1", "lease", {
        id: 1,
        state: TicketState.Open,
        category: "challenge",
        item: "pwn-hello",
        provider: "discord",
        provider_id: null,
        created_at: new Date("1970-01-01T00:00:00Z"),
      }),
    ).rejects.toThrowError("discord config is not present");
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
    const res = mock<KyResponse<APIThreadChannel>>();
    res.json.mockResolvedValue({
      id: "2222",
    });
    teamService.getMembers.mockResolvedValue([
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
    mockKy.post.mockResolvedValueOnce(res);
    await provider.open("user:1", "lease", {
      id: 42,
      state: TicketState.Created,
      team_id: 1,
      category: "challenge",
      item: "pwn-hello",
      provider: "discord",
      provider_id: null,
      created_at: date,
    });
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
          name: "Actor",
          value: "<@10>",
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
    expect(ticketService.updateStateOrProvider).toBeCalledWith(42, {
      state: TicketState.Open,
      provider_id: "2222",
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
    const res = mock<KyResponse<APIThreadChannel>>();
    res.json.mockResolvedValue({
      id: "2222",
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
    mockKy.post.mockResolvedValueOnce(res);
    await provider.open("user:1", "lease", {
      id: 42,
      state: TicketState.Created,
      category: "challenge",
      item: "pwn-hello",
      user_id: 1,
      provider: "discord",
      provider_id: null,
      created_at: date,
    });
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
          name: "Actor",
          value: "<@10>",
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
    expect(ticketService.updateStateOrProvider).toBeCalledWith(42, {
      state: TicketState.Open,
      provider_id: "2222",
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
    const res = mock<KyResponse<APIThreadChannel>>();
    res.json.mockResolvedValue({
      id: "2222",
    });
    mockKy.post.mockResolvedValueOnce(res);
    await provider.open("user:1", "lease", {
      id: 42,
      state: TicketState.Created,
      user_id: 1,
      category: "challenge",
      item: "pwn-hello",
      provider: "discord",
      provider_id: null,
      created_at: date,
    });
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
          name: "Actor",
          value: "user:1",
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
    expect(ticketService.updateStateOrProvider).toBeCalledWith(42, {
      state: TicketState.Open,
      provider_id: "2222",
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
    mockKyResponse.json.mockResolvedValueOnce(apiThreadMembers);
    mockKy.get.mockResolvedValueOnce(mockKyResponse);
    vi.mocked(teamService).getMembers.mockResolvedValue([
      { user_id: 1, role: "member" },
      { user_id: 2, role: "member" },
      { user_id: 3, role: "member" },
    ]);
    await provider.open("user:1", "lease", {
      id: 42,
      state: TicketState.Closed,
      category: "challenge",
      item: "pwn-hello",
      team_id: 1,
      provider: "discord",
      provider_id: "2222",
      created_at: date,
    });
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
          name: "Actor",
          value: "<@10>",
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
    expect(ticketService.updateStateOrProvider).toBeCalledWith(42, {
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
    await provider.close("discord:10", "lease", {
      id: 42,
      state: TicketState.Open,
      category: "challenge",
      item: "pwn-hello",
      team_id: 1,
      provider: "discord",
      provider_id: "2222",
      created_at: date,
    });

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
          name: "Actor",
          value: "<@10>",
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
    expect(ticketService.updateStateOrProvider).toBeCalledWith(42, {
      state: TicketState.Closed,
    });
  });
});
