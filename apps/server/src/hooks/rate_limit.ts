import { TooManyRequestsError } from "@noctf/server-core/errors";
import { RateLimitBucket } from "@noctf/server-core/services/rate_limit";
import { FastifyReply, FastifyRequest } from "fastify";

const DEFAULT_CONFIG = (r: FastifyRequest) => ({
  key: r.routeOptions.url && `all:${r.user ? "u" + r.user.id : "i" + r.ip}`,
  limit: r.user ? 250 : 1000,
  windowSeconds: 60,
});

export const RateLimitHook = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { rateLimitService } = request.server.container.cradle;
  const config = request.routeOptions.schema?.rateLimit || DEFAULT_CONFIG;
  let buckets: RateLimitBucket[] = [];
  if (typeof config === "function") {
    const derived = await config(request);
    if (Array.isArray(derived)) {
      buckets = derived;
    } else {
      buckets.push(derived);
    }
  } else if (Array.isArray(config)) {
    buckets = config;
  } else {
    buckets.push(config);
  }

  const next = await rateLimitService.evaluate(buckets);
  if (next) {
    reply.header("x-ratelimit-reset", next);
    throw new TooManyRequestsError("You're trying too hard");
  }
};
