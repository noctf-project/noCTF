import {
  DATABASE_CLIENT,
  DATABASE_CONNECTION,
  HOSTNAME, SECRETS_DIR, SECRETS_WATCH, TOKEN_EXPIRY,
} from '../config';
import AuthTokenService from './auth_token';
import DatabaseService from './database';
import SecretsService from './secrets';

// Singleton class which exposes services
export class Services {
  private _secrets: SecretsService;

  private _authToken: AuthTokenService;

  private _database: DatabaseService;

  constructor() {
    this._secrets = new SecretsService(SECRETS_DIR, SECRETS_WATCH);
    this._authToken = new AuthTokenService(this._secrets, HOSTNAME, TOKEN_EXPIRY);
    this._database = new DatabaseService(DATABASE_CLIENT, DATABASE_CONNECTION);
  }

  get secrets() {
    return this._secrets;
  }

  get authToken() {
    return this._authToken;
  }

  get database() {
    return this._database;
  }
}

export default new Services();
