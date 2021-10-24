import {
  DATABASE_CLIENT, DATABASE_CONNECTION,
  HOSTNAME, METRICS_FILENAME, REDIS_URL, TOKEN_EXPIRY,
} from '../config';
import AuthTokenService from './auth_token';
import CacheService from './cache';
import DatabaseService from './database';
import MetricsService from './metrics';

// Singleton class which exposes services
export class Services {
  private _metrics: MetricsService;

  private _authToken: AuthTokenService;

  private _cache: CacheService;

  private _database: DatabaseService;

  constructor() {
    this._metrics = new MetricsService(METRICS_FILENAME);
    this._cache = new CacheService(REDIS_URL, this._metrics);
    this._authToken = new AuthTokenService(HOSTNAME, TOKEN_EXPIRY, this._metrics, this._cache);
    this._database = new DatabaseService(DATABASE_CLIENT, DATABASE_CONNECTION);
  }

  get metrics() {
    return this._metrics;
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
