import { RouteHandler } from 'fastify';
import { ERROR_UNAUTHORIZED } from '../util/constants';

const pbacHook: RouteHandler = async (request, reply) => {
  // skip if we can't find a pbac config value
  if (!reply.context.config.permission) {
    return;
  }

  if (!request.auth) {
    // use public permissions

    // Always allow this permission
    // TODO: allow admins to login but not users if the permission is unset
    if (reply.context.config.permission === 'auth.public.login') {
      return;
    }

    reply.code(401).send({
      error: ERROR_UNAUTHORIZED,
    });
    return;
  }

  // Always allow this permission
  if (reply.context.config.permission === 'auth.self.session') {
    return;
  }

  // TODO: check permissions
  request.log.info('TODO: check permissions');
};

export default pbacHook;
