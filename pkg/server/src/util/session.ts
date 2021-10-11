import { createHash, randomBytes } from 'crypto';
import UserSessionDAO from '../models/UserSession';
import services from '../services';

export const createSession = async (id: number, aid: number, scope: string[] = []) => {
  const refresh = (await randomBytes(48)).toString('base64url');
  const sid = createHash('sha256').update(refresh).digest();
  await UserSessionDAO.create({
    session_hash: sid.toString('base64url'),
    user_id: id,
    scope: scope.join(','),
    app_id: aid || null,
    expires_at: null,
  });

  let perms = ['*'];
  if (aid !== 0 || scope.length !== 0) {
    // TODO: convert scope to perms
    perms = [];
  }

  const access = await services.authToken.generate(aid, id, perms, sid);
  return { refresh, access };
};
