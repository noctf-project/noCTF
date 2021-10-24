import services from '../services';
import BaseDAO from './Base';
import CacheService from '../services/cache';
import DatabaseService from '../services/database';
import { CreationTrackedObject, IndexedObject } from './Common';

export type Role = IndexedObject & CreationTrackedObject & {
  name: string;
  description: string;
  permissions: string;
};

export class RoleError extends Error {
}

// TODO: kill idName cache when role is changed/deleted
export class RoleDAO extends BaseDAO {
  tableName = 'roles';

  public async getRole(id: number): Promise<Role | undefined> {
    return this.cache.computeIfAbsent(`roles:${id}`, async () => await (this.database
      .builder(this.tableName)
      .select('*')
      .where({ id })
      .first()) || null);
  }

  /**
   * Get role permissions by ID.
   * Note: this function is cached for performance,
   * use another endpoint if consistency is needed.
   * @param id
   * @returns
   */
  public async getPermissionsByID(id: number): Promise<string[]> {
    return this.cache.computeIfAbsent(`roles_permissions:${id}`, async () => {
      const perms = await this.database
        .builder(this.tableName)
        .select('permissions')
        .where({ id })
        .first();
      if (!perms) return [];

      return perms.permissions.split(',').sort();
    }, 60, 3);
  }

  public async getByName(name: string): Promise<Role | undefined> {
    const id = await this.getIDByName(name);
    if (!id) return;
    return this.getRole(id);
  }

  public async getIDByName(name: string): Promise<number | undefined> {
    const key = name.toLowerCase();

    return this.cache.computeIfAbsent(`roles_idName:${key}`, async () => (
      await this.database.builder(this.tableName)
        .select('id')
        .where({ name: key })
        .first())?.id) || null;
  }
}

export default new RoleDAO(services.database, services.cache);
