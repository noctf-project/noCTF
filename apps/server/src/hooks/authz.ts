import type { FastifyRequest } from "fastify";
import { ForbiddenError } from "@noctf/server-core/errors";
import { LocalCache } from "@noctf/server-core/util/local_cache";

let cache: LocalCache;

export const AuthzHook = async (request: FastifyRequest) => {
  if (!cache) {
    cache = new LocalCache({
      max: 10000,
      ttl: 3000,
      dispose: LocalCache.disposeMetricsHook(
        request.server.container.cradle.metricsClient,
        "AuthzHook",
      ),
    });
  }
  const { policyService } = request.server.container.cradle;

  const policy = request.routeOptions.schema?.auth?.policy;
  if (!policy) {
    return;
  }
  const expanded = typeof policy === "function" ? await policy() : policy;
  const routeKey = `${request.user?.id || 0}${request.routeOptions.method}${request.routeOptions.url}`;

  if (
    !(await cache.load(routeKey, () =>
      policyService.evaluate(request.user?.id || 0, expanded),
    ))
  ) {
    throw new ForbiddenError("Access denied by policy");
  }
};
