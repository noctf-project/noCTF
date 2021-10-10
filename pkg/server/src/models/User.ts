import { createHmac, randomBytes } from 'crypto';
import { TOKEN_EXPIRY } from '../config';
import services from '../services';
import CacheService from '../services/cache';
import DatabaseService from '../services/database';
import { now } from '../util/helpers';
import { evaluateSingle } from '../util/permissions';
import { AuthTokenVerify } from '../util/types';
import RoleDAO from './Role';

export type User = {
  id: number;
  name: string;
  email: string;
  password?: string;
  created_at: number;
  banned: boolean;
};

const VERIFY_TOKEN_EXPIRY = 3600;

// TODO: kill idEmail cache when user is changed/deleted
export class UserDAO {
  private tableName = 'users';

  private roleTableName = 'user_roles';

  constructor(private database: DatabaseService, private cache: CacheService) {
  }

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
    await this.addRole(res[0], 'default');

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
    const expires = now() + TOKEN_EXPIRY;
    const payload: AuthTokenVerify = {
      typ: 'verify',
      uid: id,
      tok: nonce,
      exp: expires,
    };
    const token = await services.authToken.signPayload(payload);

    const hash = createHmac('sha256', Buffer.from(token))
      .update(nonce)
      .digest()
      .toString('base64url');

    await this.database.builder(this.tableName)
      .update({
        verify_hash: hash,
      })
      .where({ id });

    return {
      token,
      expires: VERIFY_TOKEN_EXPIRY,
    };
  }

  public async getById(id: number): Promise<User> {
    return this.cache.computeIfAbsent(`users:${id}`, () => this.database.builder(this.tableName)
      .select('*')
      .where({ id })
      .first());
  }

  public async getByEmail(name: string): Promise<User | null> {
    const id = await this.getIDByEmail(name);
    if (!id) return null;
    return this.getById(id);
  }

  public async getIDByEmail(email: string): Promise<number | null> {
    const key = email.toLowerCase();

    return this.cache.computeIfAbsent(`users_idEmail:${key}`, async () => (
      await this.database.builder(this.tableName)
        .select('id')
        .where({ email: key })
        .first())?.id);
  }

  public async getIDByName(name: string): Promise<number | null> {
    return this.cache.computeIfAbsent(`users_idName:${name}`, async () => (
      await this.database.builder(this.tableName)
        .select('id')
        .where({ name })
        .first())?.id);
  }

  public async getPermissions(id: number): Promise<string[]> {
    return this.cache.computeIfAbsent(`users_permission:${id}`, async () => (await Promise.all(
      (await this.database.builder(this.roleTableName)
        .select('role_id')
        .where({ user_id: id })
      ).map(({ role_id }) => RoleDAO.getRolePermissionsById(role_id)),
    ))
      .flat()
      .sort()
      .reduce((total: string[], current) => { // Reduce step to simplify permissions
        if (total.length === 0 || !evaluateSingle(total[total.length - 1], current)) {
          total.push(current);
        }
        return total;
      }, []));
  }

  public async addRole(id: number, role: string) {
    const roleId = await RoleDAO.getRoleIDByName(role);
    await this.database.builder(this.roleTableName)
      .insert({ user_id: id, role_id: roleId });

    // clear the cache
    await this.cache.purge(`users_permission:${id}`);
  }
}

export default new UserDAO(services.database, services.cache);
