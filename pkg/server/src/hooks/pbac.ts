import { onRequestAsyncHookHandler } from 'fastify';
import RoleDAO from '../models/Role';
import UserDAO from '../models/User';
import { ERROR_FORBIDDEN, ERROR_UNAUTHORIZED } from '../util/constants';
import { evaluate } from '../util/permissions';

const pbacHook: onRequestAsyncHookHandler<any, any, any> = async (request, reply) => {
  // skip if we can't find a pbac config value
  if (!reply.context.config.permission) {
    return;
  }

  // Always allow this permission
  if (reply.context.config.permission === 'auth.self.permission') {
    return;
  }

  if (!request.auth) {
    // Always allow this permission
    // TODO: allow admins to login but not users if the permission is unset
    if (reply.context.config.permission === 'auth.public.login') {
      return;
    }

    // use public permissions
    const roles = await RoleDAO.getRolePermissionsByName('public');

    const [allowed] = evaluate(reply.context.config.permission, roles);
    if (allowed) {
      return;
    }

    reply.code(401).send({
      error: ERROR_UNAUTHORIZED,
    });
    return;
  }

  // Always allow this permission when logged in
  if (reply.context.config.permission === 'auth.self.session') {
    return;
  }

  const roles = await UserDAO.getPermissions(request.auth.uid);
  if (evaluate(reply.context.config.permission, roles)) {
    return;
  }

  reply.code(403).send({
    error: ERROR_FORBIDDEN,
  });
};

export default pbacHook;
