import type { FastifyRequest } from "fastify";
import type { AuthScopedToken, AuthSessionToken } from "@noctf/api/token";
import {
  AuthenticationError,
  TokenValidationError,
} from "@noctf/server-core/errors";
import { CreateThenable } from "@noctf/server-core/util/promises";

export const AuthnHook = async (request: FastifyRequest) => {
  const { require, scopes } = request.routeOptions.schema?.auth || {};
  let token = "";
  if (
    request.headers["authorization"] &&
    request.headers["authorization"].startsWith("Bearer ")
  ) {
    token = request.headers["authorization"].substring(7);
  }
  if (!token && require) {
    throw new AuthenticationError("no authorization header supplied");
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
