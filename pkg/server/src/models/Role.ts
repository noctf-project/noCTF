import services from '../services';
import BaseDAO from './Base';

export type Role = {
  id: number;
  name: string;
  description: string;
  permissions: string;
  created_at: number;
};

export class RoleError extends Error {
}

// TODO: kill idName cache when role is changed/deleted
export class RoleDAO extends BaseDAO {
  tableName = 'roles';

  public async getRole(id: number): Promise<Role | null> {
    return this.cache.computeIfAbsent(`roles:${id}`, async () => await (this.database
      .builder(this.tableName)
      .select('*')
      .where({ id })
      .first()) || null);
  }

  public async getPermissionsByID(id: number): Promise<string[]> {
    return this.cache.computeIfAbsent(`roles_permissions:${id}`, async () => {
      const perms = await this.database
        .builder(this.tableName)
        .select('permissions')
        .where({ id })
        .first();
      if (!perms) return [];

      return perms.permissions.split(',').sort();
    });
  }

  public async getByName(name: string): Promise<Role | null> {
    const id = await this.getIDByName(name);
    if (!id) return null;
    return this.getRole(id);
  }

  public async getIDByName(name: string): Promise<number | null> {
    const key = name.toLowerCase();

    return this.cache.computeIfAbsent(`roles_idName:${key}`, async () => (
      await this.database.builder(this.tableName)
        .select('id')
        .where({ name: key })
        .first())?.id) || null;
  }
}

export default new RoleDAO(services.database, services.cache);
