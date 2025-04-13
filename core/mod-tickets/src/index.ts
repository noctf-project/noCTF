import type { ServiceCradle } from "@noctf/server-core";
import type { FastifyInstance } from "fastify";
import { DEFAULT_CONFIG, TicketConfig } from "./schema/config.ts";
import { OpenTicketRequest, OpenTicketResponse } from "./schema/api.ts";
import "@noctf/server-core/types/fastify";
import { TicketService } from "./service.ts";
import { DiscordProvider } from "./providers/discord.ts";
import type {
  TicketApplyMessage,
  TicketStateMessage,
} from "./schema/datatypes.ts";
import { TicketState } from "./schema/datatypes.ts";
import { EventBusNonRetryableError } from "@noctf/server-core/services/event_bus";

export async function initServer(fastify: FastifyInstance) {
  const { configService } = fastify.container.cradle as ServiceCradle;
  await configService.register(TicketConfig, DEFAULT_CONFIG);

  fastify.post<{ Request: OpenTicketRequest; Reply: OpenTicketResponse }>(
    "/tickets",
    {
      schema: {
        tags: ["tickets"],
        security: [{ bearer: [] }],
        body: OpenTicketRequest,
        auth: {
          require: true,
        },
        response: {
          "2xx": OpenTicketResponse,
        },
      },
    },
    async () => {
      return {
        data: {
          id: 0,
        },
      };
    },
  );
}

export async function initWorker(signal: AbortSignal, cradle: ServiceCradle) {
  const { eventBusService } = cradle;
  const ticketService = new TicketService(cradle);
  const discordProvider = new DiscordProvider({ ...cradle, ticketService });

  const StateHandler = async (message: TicketStateMessage) => {
    const { lease, id, desired_state } = message;
    const ticket = await ticketService.get(id);
    if (ticket.provider !== "discord")
      throw new Error(
        "Ticket provider is not discord (others not implemented).",
      );
    if (ticket.state === desired_state) {
      return;
    }
    try {
      if (desired_state === TicketState.Open) {
        await discordProvider.open(ticket);
      } else if (desired_state === TicketState.Closed) {
        await discordProvider.close(ticket);
      }
    } catch (e) {
      if (e instanceof EventBusNonRetryableError) {
        await ticketService.dropLease(ticket.id, lease);
      }
      throw e;
    }
    await ticketService.dropLease(ticket.id, lease);
  };

  const ApplyHandler = async (message: TicketApplyMessage) => {
    const { properties, id, lease } = message;
    // Right now we only support assignee updates
    if (!properties.assignee_id && properties.assignee_id !== null) {
      await ticketService.dropLease(id, lease);
      return;
    }

    try {
      // Have to grab the whole ticket anyways
      await discordProvider.assign(await ticketService.get(id));
    } catch (e) {
      if (e instanceof EventBusNonRetryableError) {
        await ticketService.dropLease(id, lease);
      }
      throw e;
    }
  };

  await eventBusService.subscribe<TicketStateMessage | TicketApplyMessage>(
    signal,
    "TicketWorker",
    ["queue.ticket.state", "queue.ticket.apply"],
    {
      concurrency: 3,
      handler: async (data) => {
        switch (data.subject) {
          case "queue.ticket.state":
            await StateHandler(data.data as TicketStateMessage);
            break;
          case "queue.ticket.apply":
            await ApplyHandler(data.data as TicketApplyMessage);
            break;
          default:
            throw new EventBusNonRetryableError(
              "Unknown message subject " + data.subject,
            );
        }
      },
    },
  );
}
