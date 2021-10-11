import { createHash, randomBytes } from 'crypto';
import UserSessionDAO from '../models/UserSession';
import services from '../services';

export const createSession = async (id: number, scope = []) => {
  const refresh = (await randomBytes(48)).toString('base64url');
  const sid = createHash('sha256').update(refresh).digest();
  await UserSessionDAO.create({
    session_hash: sid.toString('base64url'),
    user_id: id,
    scope: scope.join(','),
    client_id: null,
    expires_at: null,
  });
  const access = await services.authToken.generate(0, id, scope, sid);
  return { refresh, access };
};
