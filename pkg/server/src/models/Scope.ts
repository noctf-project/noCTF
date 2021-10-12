import services from '../services';
import BaseDAO from './Base';

export type Scope = {
  id: number;
  name: string;
  description: string;
  permissions: string;
  created_at?: number;
};

export class ScopeDAO extends BaseDAO {
  tableName = 'scopes';

  /**
   * Get a scope by ID
   * @param id id
   * @returns Scope object if exists, else null
   */
  public async getById(id: number): Promise<Scope | null> {
    return this.cache.computeIfAbsent(`scopes:${id}`, async () => (await this.database
      .builder(this.tableName)
      .select('*')
      .where({ id })
      .first()) || null);
  }

  /**
   * Get a scope by name. Return directly with a short TTL for performance
   * @param name name
   * @returns App object if exists, else null
   */
  public async getByName(name: string): Promise<Scope | null> {
    const key = name.toLowerCase();
    return this.cache.computeIfAbsent(`scopes_byName:${key}`, async () => await (this.database
      .builder(this.tableName)
      .select('*')
      .where({ name: key })
      .first()) || null, 60);
  }

  /**
   * Get a scope's permissions by name.
   * @param name name
   * @returns App object if exists, else null
   */
  public async getPermissionsByName(name: string): Promise<string[]> {
    const scope = await this.getByName(name);
    if (!scope) return [];
    return scope.permissions.split(',').sort();
  }
}

export default new ScopeDAO(services.database, services.cache);
