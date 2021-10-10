import { onRequestAsyncHookHandler } from 'fastify';
import services from '../services';
import { AuthTokenServiceError } from '../services/auth_token';

const MAX_TOKEN_LENGTH = 768;

const authHook: onRequestAsyncHookHandler<any, any, any> = async (request) => {
  // skip if we can't find a pbac config value
  if (!request.headers.authorization) {
    return;
  }

  const token = request.headers.authorization?.match(/^Bearer (.*)$/);
  if (!token) {
    return;
  }

  try {
    if (token[1].length > MAX_TOKEN_LENGTH) {
      return;
    }

    request.auth = await services.authToken.parse(token[1]);
  } catch (e) {
    if (e instanceof AuthTokenServiceError) {
      request.log.warn({ reason: e.message }, 'invalid auth token');
      return;
    }
    throw e;
  }
};

export default authHook;
