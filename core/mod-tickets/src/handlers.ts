import { ServiceCradle } from "@noctf/server-core";
import { FastifyInstance } from "fastify";
import { TicketService } from "./service.ts";
import { DEFAULT_CONFIG, TicketConfig } from "./schema/config.ts";
import {
  OpenTicketRequest,
  OpenTicketResponse,
  UpdateTicketRequest,
  UpdateTicketResponse,
} from "./schema/api.ts";
import { ForbiddenError, NotFoundError } from "@noctf/server-core/errors";
import { SupportSpecFactory } from "./specs.ts";
import { IdParams } from "@noctf/api/params";
import { GetRouteUserIPKey } from "@noctf/server-core/util/limit_keys";

export async function handlers(fastify: FastifyInstance) {
  const { configService, policyService } = fastify.container
    .cradle as ServiceCradle;
  await configService.register(TicketConfig, DEFAULT_CONFIG);

  const ticketService = new TicketService(fastify.container.cradle);
  const specFactory = new SupportSpecFactory(fastify.container.cradle);

  fastify.post<{ Body: OpenTicketRequest; Reply: OpenTicketResponse }>(
    "/tickets",
    {
      schema: {
        tags: ["tickets"],
        security: [{ bearer: [] }],
        rateLimit: async (r) => [
          {
            key: GetRouteUserIPKey(r),
            windowSeconds: 60,
            limit: (await policyService.evaluate(r.user.id, [
              "admin.ticket.create",
            ]))
              ? 60
              : 1,
          },
        ],
        body: OpenTicketRequest,
        auth: {
          require: true,
          policy: ["OR", "ticket.create", "amdin.ticket.create"],
        },
        response: {
          "2xx": OpenTicketResponse,
        },
      },
    },
    async (request) => {
      const config = await configService.get(TicketConfig);
      if (
        !config.value.enabled &&
        !(await policyService.evaluate(request.user.id, [
          "admin.ticket.create",
        ]))
      ) {
        throw new ForbiddenError(
          "Ticket functionality is currently not enabled",
        );
      }
      const spec = await specFactory.get(
        request.body.category,
        request.body.item,
      );
      if (!spec.can_open) {
        // We don't want to leak the existence of challenges
        throw new NotFoundError("Item not found");
      }

      const ticket = await ticketService.create(
        {
          category: request.body.category,
          item: spec.id,
          team_id:
            spec.requester === "team"
              ? (await request.user.membership)?.team_id
              : undefined,
          user_id: spec.requester === "user" ? request.user.id : undefined,
        },
        `user:${request.user.id}`,
      );
      return {
        data: {
          id: ticket.id,
        },
      };
    },
  );

  fastify.put<{
    Body: UpdateTicketRequest;
    Params: IdParams;
    Reply: UpdateTicketResponse;
  }>(
    "/tickets/:id",
    {
      schema: {
        tags: ["tickets"],
        security: [{ bearer: [] }],
        rateLimit: async (r) => [
          {
            key: GetRouteUserIPKey(r),
            windowSeconds: 60,
            limit: (await policyService.evaluate(r.user.id, [
              "admin.ticket.update",
            ]))
              ? 60
              : 1,
          },
        ],
        body: UpdateTicketRequest,
        params: IdParams,
        auth: {
          require: true,
          policy: ["OR", "ticket.update", "admin.ticket.update"],
        },
        response: {
          "2xx": UpdateTicketResponse,
        },
      },
    },
    async (request) => {
      const config = await configService.get(TicketConfig);
      const isAdmin = await policyService.evaluate(request.user.id, [
        "admin.ticket.update",
      ]);
      if (!config.value.enabled && !isAdmin) {
        throw new ForbiddenError(
          "Ticket functionality is currently not enabled",
        );
      }
      if (!isAdmin && request.body.assignee_id) {
        throw new ForbiddenError("You are not allowed to modify the assignee");
      }
      const result = await ticketService.apply(
        request.params.id,
        {
          state: request.body.state,
          assignee_id: request.body.assignee_id || undefined,
        },
        `user:${request.user.id}`,
      );
      return {
        data: { state: request.body.state },
      };
    },
  );
}
