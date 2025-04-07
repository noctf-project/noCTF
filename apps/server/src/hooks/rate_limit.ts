import { TooManyRequestsError } from "@noctf/server-core/errors";
import { FastifyReply, FastifyRequest, FastifySchema } from "fastify";

// TODO: block based on 48 bits of ipv6, full ipv4
const DEFAULT_KEY = (r: FastifyRequest) =>
  r.routeOptions.url && `all:${r.user ? 'u'+r.user.id : 'i' + r.ip}`;
const DEFAULT_CONFIG: FastifySchema["rateLimit"] = {
  key: DEFAULT_KEY,
  limit: (r) => r.user ? 250 : 1000,
  windowSeconds: 60,
};

export const RateLimitHook = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { rateLimitService } = request.server.container.cradle;
  const config = request.routeOptions.schema?.rateLimit || DEFAULT_CONFIG;
  const windowSeconds = config.windowSeconds || 60;
  const limit =
    typeof config.limit === "function" ? await config.limit(request) : config.limit;
  const key =
    config.key && (await (config.key(request) || DEFAULT_KEY(request)));
  if (!key) return;
  const next = await rateLimitService.check(key, { windowSeconds, limit });
  if (next) {
    reply.header("x-ratelimit-reset", Date.now() + next);
    throw new TooManyRequestsError("You're trying too hard");
  }
};
