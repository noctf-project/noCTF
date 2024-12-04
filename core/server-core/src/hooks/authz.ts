import { FastifyRequest } from "fastify";
import { ForbiddenError } from "../errors.ts";
import { StringOrSet } from "../types/primitives.ts";

export const AuthzFlagHook =
  (flag: StringOrSet | (() => StringOrSet | Promise<StringOrSet>)) =>
  async (request: FastifyRequest) => {
    const { userService } = request.server.container.cradle;
    const uFlags = await userService.getFlags(request.user);
    const data = typeof flag === "function" ? await flag() : flag;
    if (typeof data === "string" && uFlags.includes(data)) {
      return;
    }
    if (uFlags.some((f) => (data as Set<string>).has(f))) {
      return;
    }
    throw new ForbiddenError();
  };
