import type { TeamService } from "../services/team.ts";
import type { Policy } from "../util/policy.ts";

declare module "fastify" {
  interface FastifySchema {
    tags?: string[];
    description?: string;
    security?: [{ [key: string]: unknown }];
    auth?: {
      require?: boolean;
      scopes?: Set<string>;
      policy?: Policy | (() => Promise<Policy> | Policy);
    };
    rateLimit?: {
      key?: (
        r: FastifyRequest,
      ) =>
        | string
        | string[]
        | undefined
        | Promise<string | string[] | undefined>;
      limit:
        | number
        | number[]
        | ((
            r: FastifyRequest,
          ) => Promise<number | number[]> | number | number[]);
      windowSeconds?: number; // by default 1 minute
    };
  }

  interface FastifyRequest {
    user?: {
      id: number;
      token: string;
      membership: PromiseLike<
        Awaited<ReturnType<TeamService["getMembershipForUser"]>>
      >;
    };
  }
}
