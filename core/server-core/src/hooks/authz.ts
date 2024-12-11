import { FastifyRequest } from "fastify";
import { ForbiddenError } from "../errors.ts";

const CACHE_NAMESPACE = "core:hook:authz";


export const AuthzHook = async (request: FastifyRequest) => {
  const { userService, roleService, cacheService: cacheService } = request.server.container.cradle;
  
  const policy = request.routeOptions.schema?.auth?.policy;
  if (!policy) {
    return;
  }
  const expanded = typeof policy === 'function' ? await policy() : policy;

  const routeKey = `${request.routeOptions.method}:${request.routeOptions.url}`;
  const evaluateCached = async (roleId: number) => {
    return await cacheService.load(`${CACHE_NAMESPACE}:r:${roleId}:${routeKey}`,
      () => roleService.evaluate(roleId, expanded));
  };

  // Run the public policy
  if (!request.user) {
    if (!await evaluateCached((await roleService.getStaticRoleIds()).public)) {
      throw new ForbiddenError("Access denied by policy");
    }
    return;
  }

  const uFlags = await userService.getFlags(request.user.id);
  if (uFlags.some((f) => f === "blocked")) {
    throw new ForbiddenError("you have been blocked");
  }

  try {
    await Promise.any((await roleService.getUserRoleIds(request.user.id))
      .map((role) => evaluateCached(role).then((r) => r ? Promise.resolve() : Promise.reject())));
  } catch {
    throw new ForbiddenError("Access denied by policy");
  }
};
