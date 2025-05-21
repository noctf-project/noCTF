import { AssociateRequest } from "@noctf/api/requests";
import { SuccessResponse } from "@noctf/api/responses";
import { FastifyInstance } from "fastify";
import { TokenProvider } from "./token_provider.ts";
import { ForbiddenError } from "@noctf/server-core/errors";

export default async function (fastify: FastifyInstance) {
  const { identityService, configService, cacheService, emailService } =
    fastify.container.cradle;
  const tokenProvider = new TokenProvider({ cacheService });

  fastify.post<{
    Body: AssociateRequest;
    Reply: SuccessResponse;
  }>(
    "/auth/associate",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["auth"],
        auth: {
          require: true,
          policy: ["user.self.update"],
        },
        body: AssociateRequest,
        response: {
          200: SuccessResponse,
        },
      },
    },
    async (request) => {
      const { token } = request.body;
      const data = await tokenProvider.lookup("associate", token);
      if (request.user.id !== data.user_id) {
        throw new ForbiddenError("Invalid token");
      }
      await identityService.associateIdentities(
        data.identity.map((i) => ({
          user_id: request.user.id,
          ...i,
        })),
      );
      // TODO: commit flags and roles in tx
      await tokenProvider.invalidate("associate", token);
      return { data: true as true }; // wtf ts
    },
  );
}
