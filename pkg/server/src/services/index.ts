import {
  DATABASE_CLIENT, DATABASE_CONNECTION,
  HOSTNAME, REDIS_URL, TOKEN_EXPIRY,
} from '../config';
import AuthTokenService from './auth_token';
import CacheService from './cache';
import DatabaseService from './database';

// Singleton class which exposes services
export class Services {
  private _cache: CacheService;

  private _authToken: AuthTokenService;

  private _database: DatabaseService;

  constructor() {
    this._cache = new CacheService(REDIS_URL);
    this._authToken = new AuthTokenService(this._cache, HOSTNAME, TOKEN_EXPIRY);
    this._database = new DatabaseService(DATABASE_CLIENT, DATABASE_CONNECTION);
  }

  get cache() {
    return this._cache;
  }

  get authToken() {
    return this._authToken;
  }

  get database() {
    return this._database;
  }
}

export default new Services();
