import { ServiceCradle } from "@noctf/server-core";
import { FastifyInstance } from "fastify";
import { DEFAULT_CONFIG, TicketConfig } from "./schema/config.ts";
import { OpenTicketRequest, OpenTicketResponse } from "./schema/api.ts";
import "@noctf/server-core/types/fastify";
import { TicketService } from "./service.ts";
import { DiscordProvider } from "./providers/discord.ts";
import { TicketStateMessage } from "./schema/messages.ts";

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
  const handler = await eventBusService.subscribe<TicketStateMessage>(
    "ticket_state_handler",
    ["events.ticket.state.*"],
    {
      handler: async (data) => {
        const { actor, lease, ticket } = data.data;
        if (ticket.provider !== "discord")
          throw new Error("Ticket provider is not discord.");

        if (ticket.open) {
          await discordProvider.open(actor, lease, ticket);
        } else {
          await discordProvider.close(actor, lease, ticket);
        }
      },
    },
  );
}
