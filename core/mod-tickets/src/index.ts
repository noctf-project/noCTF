import { ServiceCradle } from "@noctf/server-core";
import { FastifyInstance } from "fastify";
import { DEFAULT_CONFIG, TicketConfig } from "./schema/config.ts";
import { OpenTicketRequest, OpenTicketResponse } from "./schema/api.ts";
import "@noctf/server-core/types/fastify";
import { TicketService } from "./service.ts";
import { DiscordProvider } from "./providers/discord.ts";
import { TicketStateUpdateMessage } from "./schema/messages.ts";
import { TicketState } from "./schema/datatypes.ts";
import { EventBusNonRetryableError } from "@noctf/server-core/services/event_bus";

export async function initServer(fastify: FastifyInstance) {
  initWorker(fastify.container.cradle);
  const { configService } = fastify.container.cradle as ServiceCradle;
  await configService.register<TicketConfig>(TicketConfig, DEFAULT_CONFIG);

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

export async function initWorker(cradle: ServiceCradle) {
  const { eventBusService } = cradle;
  const ticketService = new TicketService(cradle);
  const discordProvider = new DiscordProvider({ ...cradle, ticketService });
  const handler = await eventBusService.subscribe<TicketStateUpdateMessage>(
    "TicketStateHandler",
    ["queue.ticket.state"],
    {
      concurrency: 5,
      handler: async (data) => {
        const { actor, lease, id, desired_state } = data.data;
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
            await discordProvider.open(actor, lease, ticket);
          } else if (desired_state === TicketState.Closed) {
            await discordProvider.close(actor, lease, ticket);
          }
        } catch (e) {
          if (e instanceof EventBusNonRetryableError) {
            await ticketService.dropStateLease(ticket.id, lease);
          }
          throw e;
        }
        await ticketService.dropStateLease(ticket.id, lease);
      },
    },
  );
}
