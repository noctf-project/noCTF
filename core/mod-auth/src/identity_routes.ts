import { AssociateIdentity } from "@noctf/api/contract/mod_auth";
import { FastifyInstance } from "fastify";
import { ForbiddenError } from "@noctf/server-core/errors";
import { route } from "@noctf/server-core/util/route";

export default async function (fastify: FastifyInstance) {
  const { identityService, tokenService } = fastify.container.cradle;

  route(
    fastify,
    AssociateIdentity,
    {
      auth: {
        require: true,
        policy: ["user.self.update"],
      },
    },
    async (request) => {
      const { token } = request.body;
      const data = await tokenService.lookup("associate", token);
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
      await tokenService.invalidate("associate", token);
      return { data: true as const }; // wtf ts
    },
  );
}
