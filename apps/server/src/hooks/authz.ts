import type { FastifyRequest } from "fastify";
import { ForbiddenError, UnauthorizedError } from "@noctf/server-core/errors";

export const AuthzHook = async (request: FastifyRequest) => {
  const { policyService } = request.server.container.cradle;

  const policy = request.routeOptions.config?.auth?.policy;
  if (!policy) {
    return;
  }
  const expanded = typeof policy === "function" ? await policy() : policy;
  if (!(await policyService.evaluate(request.user?.id || 0, expanded))) {
    if (request.user) throw new ForbiddenError("Access denied by policy");
    throw new UnauthorizedError();
  }
};
