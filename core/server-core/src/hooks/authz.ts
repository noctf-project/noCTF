import { FastifyRequest } from "fastify";
import { ForbiddenError } from "../errors.ts";
import { StringOrSet } from "../types/primitives.ts";

export const AuthzFlagHook =
  (flag?: StringOrSet | (() => StringOrSet | Promise<StringOrSet>)) =>
  async (request: FastifyRequest) => {
    const { userService } = request.server.container.cradle;
    const uFlags = await userService.getFlags(request.user);
    if (uFlags.some((f) => f === "blocked")) {
      throw new ForbiddenError("you have been blocked");
    }

    if (!flag) return;
    const data = typeof flag === "function" ? await flag() : flag;
    if (!data) return;
    if (typeof data === "string") {
      if (uFlags.includes(data as string)) return;
      throw new ForbiddenError(`user does not have flag(s): ${data}`);
    }
    if (
      !(data as Set<string>).size ||
      uFlags.some((f) => (data as Set<string>).has(f))
    ) {
      return;
    }
    throw new ForbiddenError(`user does not have flag(s): ${data}`);
  };
