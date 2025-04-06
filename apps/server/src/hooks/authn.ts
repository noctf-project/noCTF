import type { FastifyRequest } from "fastify";
import type { AuthScopedToken, AuthSessionToken } from "@noctf/api/token";
import {
  AuthenticationError,
  TokenValidationError,
} from "@noctf/server-core/errors";
import { NOCTF_SESSION_COOKIE } from "@noctf/mod-auth/const";
import { TeamService } from "@noctf/server-core/services/team";
import { CreateThenable } from "@noctf/server-core/util/promises";

type Membership = Awaited<ReturnType<TeamService["getMembershipForUser"]>>;

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
    token = parseCookie(request.headers["cookie"])[NOCTF_SESSION_COOKIE];
  }
  if (!token && require) {
    throw new AuthenticationError("no cookie or authorization header supplied");
  } else if (!token && !require) {
    return;
  }

  const { identityService, teamService } = request.server.container.cradle;
  let tokenData: AuthSessionToken | AuthScopedToken;
  try {
    tokenData = await identityService.validateToken(
      token,
      ["scoped", "session"],
      { localVerifyRevocation: true },
    );

    request.user = {
      id: tokenData.sub,
      token,
      membership: CreateThenable(() =>
        teamService.getMembershipForUser(tokenData.sub),
      ),
    };
  } catch (e) {
    if (!require && e instanceof TokenValidationError) {
      return;
    }
    throw e;
  }

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
