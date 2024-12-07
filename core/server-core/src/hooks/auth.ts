import { FastifyRequest } from "fastify";
import { AuthScopedToken, AuthSessionToken } from "@noctf/api/token";
import { AuthenticationError } from "../errors.ts";
import { StringOrSet } from "../types/primitives.ts";

const parseCookie = (str: string) =>
  str
    .split(";")
    .map((v) => v.split("="))
    .reduce(
      (acc, v) => {
        acc[decodeURIComponent(v[0].trim())] = decodeURIComponent(v[1].trim());
        return acc;
      },
      {} as { [key: string]: string },
    );

declare module "fastify" {
  interface FastifyRequest {
    user: number;
    token: string;
  }
}

export const AuthHook =
  (scope?: StringOrSet | (() => StringOrSet | Promise<StringOrSet>)) =>
  async (request: FastifyRequest) => {
    let token = "";
    if (
      request.headers["authorization"] &&
      request.headers["authorization"].startsWith("Bearer ")
    ) {
      token = request.headers["authorization"].substring(7);
    } else if (request.headers["cookie"]) {
      token = parseCookie(request.headers["cookie"])["noctf-session"];
    }
    if (!token) {
      throw new AuthenticationError(
        "no cookie or authorization header supplied",
      );
    }

    const { identityService } = request.server.container.cradle;
    const tokenData = await identityService.validateToken<
      AuthSessionToken | AuthScopedToken
    >(token, ["scoped", "session"]);
    request.user = tokenData.sub;
    request.token = token;

    if (!scope || tokenData.aud === "session") {
      return;
    }
    const data = typeof scope === "function" ? await scope() : scope;
    if (!data) return;
    const { scopes } = tokenData as AuthScopedToken;
    if (!data) return;
    if (typeof data === "string") {
      if (scopes.includes(data as string)) return;
      throw new AuthenticationError(
        `scoped token does not have a required scope: ${data}`,
      );
    }
    if (
      !(data as Set<string>).size ||
      scopes.some((s) => (data as Set<string>).has(s))
    ) {
      return;
    }
    throw new AuthenticationError(
      `scoped token does not have a required scope: ${data}`,
    );
  };
