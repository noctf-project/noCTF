import { createHmac } from 'crypto';
import services from '../services';
import { now } from '../util/helpers';
import BaseDAO from './Base';

export interface UserSession {
  session_hash: string;
  user_id: number;
  created_at?: number | null;
  expires_at?: number | null;
  revoked_at?: number | null;
  touched_at?: number | null;
  scope: string;
  app_id?: number | null;
}

export class UserSessionDAOError extends Error {
}

export class UserSessionDAO extends BaseDAO {
  tableName = 'user_sessions';

  public async create(refreshToken: string, user_id: number, app_id: number,
    scope: string[], expires_at?: number): Promise<Buffer> {
    const session_hash = createHmac('sha256', refreshToken)
      .update((app_id || 0).toString())
      .digest();
    await this.database.builder(this.tableName)
      .insert({
        session_hash: session_hash.toString('base64url'),
        user_id,
        scope,
        app_id: app_id || null,
        expires_at: expires_at || null,
        touched_at: now(),
      });

    return session_hash;
  }

  /**
   * Get and touch an active session. Touch sets the touched_at to current date
   * which is when the token was last refreshed.
   * @param session_hash hash of session
   * @returns
   */
  public async touchRefreshToken(refreshToken: string, aid: number): Promise<UserSession> {
    const session_hash = createHmac('sha256', refreshToken)
      .update(aid.toString())
      .digest('base64url');
    const session = await this.database.builder(this.tableName)
      .select('*')
      .where({ session_hash, revoked_at: null })
      .andWhere((w) => w.whereNull('expires_at')
        .orWhere('expires_at', '>', now()))
      .first();
    await this.database.builder(this.tableName)
      .update({ touched_at: now() })
      .where({ session_hash });
    return session;
  }

  public async revoke(user_id: number, session_hash: string): Promise<void> {
    await this.database.builder(this.tableName)
      .update({ revoked_at: now() })
      .where({ user_id, session_hash, revoked_at: null });
  }
}

export default new UserSessionDAO(services.database, services.cache);
