import { FastifyRequest, RouteGenericInterface } from "fastify";
import { RateLimitBucket } from "../services/rate_limit.ts";
import type { TeamService } from "../services/team.ts";
import type { Policy } from "../util/policy.ts";

export type RequestConfig<T extends RouteGenericInterface> = {
  auth?: {
    require?: boolean;
    scopes?: Set<string>;
    policy?: Policy | (() => Promise<Policy> | Policy);
  };
  rateLimit?:
    | RateLimitBucket
    | RateLimitBucket[]
    | ((
        r: FastifyRequest<T>,
      ) =>
        | Promise<RateLimitBucket | RateLimitBucket[]>
        | RateLimitBucket
        | RateLimitBucket[]);
};

declare module "fastify" {
  interface FastifyInstance {
    readonly apiURL: string;
  }

  interface FastifySchema {
    tags?: string[];
    description?: string;
    security?: [{ [key: string]: unknown }];
  }
  interface FastifyContextConfig {
    auth?: RequestConfig<{}>["auth"];
    rateLimit?: RequestConfig<{}>["rateLimit"];
  }

  interface FastifyRequest {
    user?: {
      app?: number;
      id: number;
      token: string;
      membership: PromiseLike<
        Awaited<ReturnType<TeamService["getMembershipForUser"]>>
      >;
    };
  }
}
