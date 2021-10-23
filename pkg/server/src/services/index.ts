import {
  DATABASE_CLIENT, DATABASE_CONNECTION,
  HOSTNAME, REDIS_URL, TOKEN_EXPIRY,
} from '../config';
import AuthTokenService from './auth_token';
import CacheService from './cache';
import DatabaseService from './database';
import BlobService from './blob';

// Singleton class which exposes services
export class Services {
  private _authToken: AuthTokenService;
  private _cache: CacheService;
  private _database: DatabaseService;
  private _blob: BlobService;

  constructor() {
    this._cache = new CacheService(REDIS_URL);
    this._authToken = new AuthTokenService(this._cache, HOSTNAME, TOKEN_EXPIRY);
    this._database = new DatabaseService(DATABASE_CLIENT, DATABASE_CONNECTION);
    this._blob = new BlobService();
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

  get blob() {
    return this._blob;
  }
}

export default new Services();
