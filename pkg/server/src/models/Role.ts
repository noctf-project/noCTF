import services from '../services';
import CacheService from '../services/cache';
import DatabaseService from '../services/database';

export type Role = {
  id: number;
  name: string;
  created_at: number;
};

export class RoleError extends Error {
}

// TODO: kill idName cache when role is changed/deleted
export class RoleDAO {
  private tableName = 'roles';

  private permissionTableName = 'role_permissions';

  constructor(private database: DatabaseService, private cache: CacheService) {
  }

  public async getRole(id: number): Promise<Role | null> {
    return this.cache.computeIfAbsent(`roles:${id}`, () => this.database.builder(this.tableName)
      .select('*')
      .where({ id })
      .first());
  }

  public async getByName(name: string): Promise<Role | null> {
    const id = await this.getRoleIDByName(name);
    if (!id) return null;
    return this.getRole(id);
  }

  public async getRolePermissionsById(id: number): Promise<string[]> {
    return this.cache.computeIfAbsent(`roles_permissions:${id}`, async () => (
      await this.database.builder(this.permissionTableName)
        .select('permission')
        .where({ role_id: id })
    )
      .map(({ permission }) => permission)
      .sort());
  }

  public async getRolePermissionsByName(name: string): Promise<string[]> {
    const id = await this.getRoleIDByName(name);
    if (!id) throw new RoleError('role doesn\'t exist');
    return this.getRolePermissionsById(id);
  }

  public async getRoleIDByName(name: string): Promise<number | null> {
    const key = name.toLowerCase();

    return this.cache.computeIfAbsent(`roles_idName:${key}`, async () => (
      await this.database.builder(this.tableName)
        .select('id')
        .where({ name: key })
        .first())?.id);
  }
}

export default new RoleDAO(services.database, services.cache);
