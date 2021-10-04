import { RouteHandler } from 'fastify';
import services from '../services';
import { AuthTokenServiceError } from '../services/auth_token';
import { ERROR_INVALID_CREDENTIALS, ERROR_UNAUTHORIZED } from '../util/constants';

const pbacHook: RouteHandler = async (request, reply) => {
  // skip if we can't find a pbac config value
  if (!reply.context.config.permission) {
    return;
  }

  if (!request.headers.authorization) {
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

  const token = request.headers.authorization?.match(/^Bearer (.*)$/);
  if (!token) {
    reply.code(401).send({
      error: ERROR_INVALID_CREDENTIALS,
    });
    return;
  }

  try {
    request.auth = await services.authToken.parse(token[1]);
  } catch (e) {
    if (e instanceof AuthTokenServiceError) {
      reply.code(401).send({
        error: e.message,
      });
    }
  }

  // Always allow this permission
  if (reply.context.config.permission === 'auth.self.session') {
    return;
  }

  // TODO: check permissions
  request.log.info('TODO: check permissions');
};

export default pbacHook;
