import { TooManyRequestsError } from "@noctf/server-core/errors";
import { RateLimitBucket } from "@noctf/server-core/services/rate_limit";
import { NormalizeIPPrefix } from "@noctf/server-core/util/limit_keys";
import { FastifyReply, FastifyRequest } from "fastify";
import { DISABLE_RATE_LIMIT } from "../config.ts";

const DEFAULT_CONFIG = (r: FastifyRequest) => ({
  key:
    r.routeOptions.url &&
    `all:${r.user ? "u" + r.user.id + (r.user.app ? "a" + r.user.app : "") : "i" + NormalizeIPPrefix(r.ip)}`,
  limit: r.user ? 200 : 500,
  windowSeconds: 60,
});

export const RateLimitHook = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  if (DISABLE_RATE_LIMIT) return;
  const { rateLimitService, policyService } = request.server.container.cradle;
  if (await policyService.evaluate(request.user?.id, ["bypass.rate_limit"])) {
    return;
  }
  const config = request.routeOptions.config?.rateLimit || DEFAULT_CONFIG;
  let buckets: RateLimitBucket[] = [];
  if (typeof config === "function") {
    const derived = await config(request);
    if (Array.isArray(derived)) {
      buckets = derived.filter((x) => x);
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
    reply.header("retry-after", Math.ceil(next / 1000));
    throw new TooManyRequestsError("You're trying too hard");
  }
};
