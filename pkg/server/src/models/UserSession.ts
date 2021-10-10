import services from '../services';
import CacheService from '../services/cache';
import DatabaseService from '../services/database';
import { now } from '../util/helpers';

export type UserSession = {
  session_hash: string;
  user_id: number;
  created_at?: number | null;
  expires_at?: number | null;
  revoked_at?: number | null;
  scope: string;
  client_id?: number | null;
};

export class UserSessionDAOError extends Error {
}

export class UserSessionDAO {
  private tableName = 'user_sessions';

  constructor(private database: DatabaseService, private cache: CacheService) {
  }

  public async create({
    session_hash,
    user_id,
    scope,
    client_id,
    expires_at,
  }: UserSession): Promise<void> {
    await this.database.builder(this.tableName)
      .insert({
        session_hash,
        user_id,
        scope,
        client_id: client_id || null,
        expires_at: expires_at || null,
      });
  }

  public async getActiveBySessionHash(session_hash: string): Promise<UserSession> {
    return this.database.builder(this.tableName)
      .select('*')
      .where({ session_hash, revoked_at: null })
      .andWhere((w) => w.whereNull('expires_at')
        .orWhere('expires_at', '>', now()))
      .first();
  }

  public async revoke(user_id: number, session_hash: string): Promise<void> {
    await this.database.builder(this.tableName)
      .update({ revoked_at: now() })
      .where({ user_id, session_hash, revoked_at: null });
  }
}

export default new UserSessionDAO(services.database, services.cache);
