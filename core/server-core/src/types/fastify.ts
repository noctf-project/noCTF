import type { Policy } from "../util/policy.ts";

declare module "fastify" {
  interface FastifySchema {
    auth?: {
      require?: boolean;
      scopes?: Set<string>;
      policy?: Policy | (() => Promise<Policy> | Policy);
    };
  }

  interface FastifyRequest {
    user?: {
      id: number;
      token: string;
    };
  }
}
