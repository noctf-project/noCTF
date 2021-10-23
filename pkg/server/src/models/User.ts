import { createHash, randomBytes } from 'crypto';
import { JWEInvalid } from 'jose/util/errors';
import { HOSTNAME, TOKEN_EXPIRY } from '../config';
import services from '../services';
import { now } from '../util/helpers';
import logger from '../util/logger';
import { AuthTokenVerify } from '../util/types';
import BaseDAO from './Base';
import RoleDAO from './Role';

const VERIFY_TOKEN_EXPIRY = 3600;
const VERIFY_TOKEN_TYPE = 'verify';

export type User = {
  id: number;
  name: string;
  email: string;
  password?: string;
  created_at: number;
  banned: boolean;
};

export class UserDAOError extends Error {
}

// TODO: kill idEmail cache when user is changed/deleted
export class UserDAO extends BaseDAO {
  tableName = 'users';

  private appRoleTableName = 'app_roles';

  private userRoleTableName = 'user_roles';

  /**
   * Create a user
   * @param user User object
   * @returns User object
   */
  public async create({ email, name }: { email: string, name: string }): Promise<User> {
    const created_at = now();
    const res = await this.database.builder(this.tableName).insert({
      name,
      email: email.toLowerCase(),
      created_at,
    }).returning('id');

    // Give user the default role
    const defaultRole = await RoleDAO.getIDByName('default');
    if (!defaultRole) {
      throw new Error('\'default\' role doe not exist, please add it');
    }
    await this.addRole(res[0], defaultRole);

    return {
      id: res[0],
      name,
      email: email.toLowerCase(),
      created_at,
      banned: false,
    };
  }

  /**
   * Generate a verification token for a user id
   * @param id user id
   * @returns verification token and expiry in seconds
   */
  public async generateVerify(id: number): Promise<{ token: string, expires: number }> {
    const nonce: Buffer = await (new Promise((resolve, reject) => (
      randomBytes(32, (err, buf) => (err ? reject(err) : resolve(buf)))))
    );
    const ctime = now();
    const expires = ctime + TOKEN_EXPIRY;
    const payload: AuthTokenVerify = {
      typ: VERIFY_TOKEN_TYPE,
      uid: id,
      tok: nonce,
      aud: HOSTNAME,
      iat: ctime,
      exp: expires,
    };
    const token = await services.authToken.encryptPayload(payload);

    const hash = createHash('sha256')
      .update(nonce)
      .digest()
      .toString('base64url');

    await this.database.builder(this.tableName)
      .update({
        verify_hash: hash,
      })
      .where({ id });

    services.cache.purge(`users:${id}`);

    return {
      token,
      expires: VERIFY_TOKEN_EXPIRY,
    };
  }

  /**
   * Validate and discard the verification token
   * @param token verification token
   */
  public async validateAndDiscardVerify(token: string): Promise<number | null> {
    const ctime = now();
    try {
      const data = (await services.authToken.decryptPayload(token)).payload as AuthTokenVerify;

      if (data.typ !== VERIFY_TOKEN_TYPE) return null;
      if (ctime > data.exp) return null;
      if (data.aud !== HOSTNAME) return null;

      // lookup verification token for user
      const { verify_hash: expectedHash } = await this.database.builder(this.tableName)
        .select('verify_hash')
        .where({ id: data.uid })
        .first();

      if (!expectedHash) {
        logger.debug({ uid: data.uid }, 'verification hash not found');
        return null;
      }
      const expectedHashBuf = Buffer.from(expectedHash, 'base64url');
      logger.debug({ expectedHashBuf }, 'verification hash found');
      const calculatedHashBuf = createHash('sha256')
        .update(data.tok)
        .digest();

      // hash the token in the jws
      if (!calculatedHashBuf.equals(expectedHashBuf)) {
        logger.debug({ calculatedHashBuf, expectedHashBuf }, 'verification hash does not match');
        return null;
      }

      // invalidate the token
      await Promise.all([
        this.database.builder(this.tableName)
          .update({ verify_hash: null })
          .where({ id: data.uid }),
        services.cache.purge(`users:${data.uid}`),
      ]);

      return data.uid;
    } catch (e) {
      if (e instanceof JWEInvalid) {
        return null;
      }
      throw e;
    }
  }

  /**
   * Set password
   * @param id user id
   * @param password password
   */
  public async setPassword(id: number, password: string): Promise<void> {
    await Promise.all([
      services.cache.purge(`users:${id}`),
      this.database.builder(this.tableName)
        .update({ password })
        .where({ id }),
      this.cache.purge(`users:${id}`),
    ]);
  }

  /**
   * Get a user by ID
   * @param id id of user
   * @returns User object if exists, else null
   */
  public async getById(id: number): Promise<User> {
    return this.cache.computeIfAbsent(`users:${id}`, () => this.database.builder(this.tableName)
      .select('*')
      .where({ id })
      .first());
  }

  /**
   * Get a user by Email
   * @param email email of user
   * @returns User object if exists, else null
   */
  public async getByEmail(email: string): Promise<User | null> {
    const id = await this.getIDByEmail(email);
    if (!id) return null;
    return this.getById(id);
  }

  /**
   * Get a user ID by email
   * @param email email of user
   * @returns id if exists else null
   */
  public async getIDByEmail(email: string): Promise<number | null> {
    const key = email.toLowerCase();

    return this.cache.computeIfAbsent(`users_idEmail:${key}`, async () => (
      await this.database.builder(this.tableName)
        .select('id')
        .where({ email: key })
        .first())?.id);
  }

  /**
   * Get User ID by name
   * @param name name of user
   * @returns id if exists else null
   */
  public async getIDByName(name: string): Promise<number | null> {
    return this.cache.computeIfAbsent(`users_idName:${name}`, async () => (
      await this.database.builder(this.tableName)
        .select('id')
        .where({ name })
        .first())?.id);
  }

  /**
   * Get a user's permissions array in a simplified form
   * @param id id of user
   * @returns simplified list of permissions (i.e. ["a.b.*", "a.b.c", "a.b.d"] -> ["a.b.*"])
   */
  public async getPermissions(id: number): Promise<string[][]> {
    return this.cache.computeIfAbsent(`users_permission:${id}`, async () => (Promise.all(
      (await this.database.builder(this.userRoleTableName)
        .select('role_id')
        .where({ user_id: id })
      ).map(({ role_id }) => RoleDAO.getPermissionsByID(role_id)),
    )), 60, 3);
  }

  /**
   * Add role to user and reset the user's permission cache
   * @param id id of user
   * @param role role name
   */
  public async addRole(id: number, roleId: number) {
    await this.database.builder(this.userRoleTableName)
      .insert({ user_id: id, role_id: roleId });

    // clear the cache
    await this.cache.purge(`users_permission:${id}`);
  }

  /**
   * Check if user can access application and cache the result for 60 seconds.
   * @param userId
   * @param appId
   */
  public async canAccessApplication(userId: number, appId: number) {
    await this.cache.computeIfAbsent(`users_app:${userId}:${appId}`, async () => !!(
      await this.database.builder(this.userRoleTableName)
        .select('1')
        .join(
          this.appRoleTableName,
          `${this.appRoleTableName}.role_id`,
          `${this.userRoleTableName}.role_id`,
        )
        .where({ user_id: userId })
        .first()),
    60);
  }
}

export default new UserDAO(services.database, services.cache);
