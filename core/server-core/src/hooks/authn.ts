import { FastifyRequest } from "fastify";
import { AuthScopedToken, AuthSessionToken } from "@noctf/api/token";
import { AuthenticationError } from "../errors.ts";

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

export const AuthnHook = async (request: FastifyRequest) => {
  const { require, scopes } = request.routeOptions.schema?.auth || {};
  let token = "";
  if (
    request.headers["authorization"] &&
    request.headers["authorization"].startsWith("Bearer ")
  ) {
    token = request.headers["authorization"].substring(7);
  } else if (request.headers["cookie"]) {
    token = parseCookie(request.headers["cookie"])["noctf-session"];
  }
  if (!token && require) {
    throw new AuthenticationError("no cookie or authorization header supplied");
  } else if (!require) {
    return;
  }

  const { identityService } = request.server.container.cradle;
  const tokenData = await identityService.validateToken<
    AuthSessionToken | AuthScopedToken
  >(token, ["scoped", "session"]);
  request.user = {
    id: tokenData.sub,
    token,
  };

  if (!scopes || !scopes.size || tokenData.aud === "session") {
    return;
  }
  const { scopes: tScopes } = tokenData as AuthScopedToken;
  if (!tScopes.some((s) => scopes.has(s))) {
    throw new AuthenticationError(
      `scoped token is not authorised to access this endpoint`,
    );
  }
};
