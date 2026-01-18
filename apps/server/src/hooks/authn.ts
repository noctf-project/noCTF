import type { FastifyRequest } from "fastify";
import type { AuthToken } from "@noctf/api/token";
import {
  AuthenticationError,
  TokenValidationError,
} from "@noctf/server-core/errors";
import { CreateThenable } from "@noctf/server-core/util/promises";

export const AuthnHook = async (request: FastifyRequest) => {
  const { require, scopes } = request.routeOptions.config?.auth || {};
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
  let tokenData: AuthToken;
  try {
    tokenData = await identityService.validateToken(token);

    const id = +tokenData.sub;
    const app = tokenData.app ? +tokenData.app : undefined;
    request.user = {
      app,
      id,
      token,
      membership: CreateThenable(() => teamService.getMembershipForUser(id)),
    };
  } catch (e) {
    if (!require && e instanceof TokenValidationError) {
      return;
    }
    throw e;
  }

  if (!scopes || !scopes.size || !tokenData.scopes) {
    return;
  }

  if (!tokenData.scopes.some((s) => scopes.has(s))) {
    throw new AuthenticationError(
      `scoped token is not authorised to access this endpoint`,
    );
  }
};
