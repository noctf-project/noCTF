import type { FastifyRequest } from "fastify";
import { ForbiddenError } from "@noctf/server-core/errors";
import { LocalCache } from "@noctf/server-core/util/local_cache";

let cache: LocalCache;

export const AuthzHook = async (request: FastifyRequest) => {
  const { policyService } = request.server.container.cradle;

  const policy = request.routeOptions.schema?.auth?.policy;
  if (!policy) {
    return;
  }
  const expanded = typeof policy === "function" ? await policy() : policy;
  if (!policyService.evaluate(request.user?.id || 0, expanded)) {
    throw new ForbiddenError("Access denied by policy");
  }
};
