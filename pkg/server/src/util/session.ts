import { randomBytes } from 'crypto';
import { promisify } from 'util';
import ScopeDAO from '../models/Scope';
import UserSessionDAO from '../models/UserSession';
import services from '../services';

const asyncRandomBytes = promisify(randomBytes);

export const createSession = async (id: number,
  aid: number,
  scope: string[] = [],
  suppliedRefresh?: string) => {
  const refresh = suppliedRefresh || (await asyncRandomBytes(48)).toString('base64url');
  const sid = await UserSessionDAO.create(refresh, id, aid, scope);

  let perms = [['*']];
  if (aid !== 0 || scope.length !== 0) {
    perms = (await Promise.all(scope.map((s) => ScopeDAO.getPermissionsByName(s))));
  }

  const access = await services.authToken.generate(aid, id, perms, sid, 0);
  return { refresh, access };
};
