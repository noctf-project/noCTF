import type { FastifyRequest } from "fastify";
import { ForbiddenError } from "@noctf/server-core/errors";

const CACHE_NAMESPACE = "core:hook:authz";

export const AuthzHook = async (request: FastifyRequest) => {
  const { policyService, cacheService: cacheService } =
    request.server.container.cradle;

  const policy = request.routeOptions.schema?.auth?.policy;
  if (!policy) {
    return;
  }
  const expanded = typeof policy === "function" ? await policy() : policy;
  const routeKey = `${request.user?.id || 0}:${request.routeOptions.method}:${request.routeOptions.url}`;
  const result = await cacheService.load(
    CACHE_NAMESPACE,
    routeKey,
    () => policyService.evaluate(request.user?.id, expanded),
    { expireSeconds: 10 },
  );

  if (!result) {
    throw new ForbiddenError("Access denied by policy");
  }
};
