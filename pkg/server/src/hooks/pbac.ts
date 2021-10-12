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
    const permissions = await RoleDAO.getPermissionsByID(
      (await RoleDAO.getIDByName('public'))!,
    );

    const [allowed] = evaluate(reply.context.config.permission, permissions);
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

  // Only allow permission for appid = 0 to derive more permissions
  if (reply.context.config.permission === 'auth.self.authorize') {
    if (request.auth.aid !== 0) {
      reply.code(403).send({
        error: ERROR_FORBIDDEN,
      });
    }
    return;
  }

  // allowed if both token and user allow the permission
  const permissions = await UserDAO.getPermissions(request.auth.uid);
  let allowedToken = false;
  for (const i of request.auth.prm) {
    const [allowed] = evaluate(reply.context.config.permission, i);
    if (allowed) {
      allowedToken = true;
      break;
    }
  }
  if (!allowedToken) {
    reply.code(403).send({
      error: ERROR_FORBIDDEN,
    });
    return;
  }

  for (const i of permissions) {
    const [allowedUser] = evaluate(reply.context.config.permission, i);
    if (allowedUser) {
      return;
    }
  }
  reply.code(403).send({
    error: ERROR_FORBIDDEN,
  });
};

export default pbacHook;
