import services from '../services';
import BaseDAO from './Base';

export type App = {
  id: number;
  name: string;
  description: string;
  client_id: string;
  client_secret_hash: string;
  allowed_redirect_uris: string;
  enabled: boolean;
};

export class AppDAO extends BaseDAO {
  tableName = 'apps';

  /**
   * Get an app by ID
   * @param id id
   * @returns App object if exists, else null
   */
  public async getById(id: number): Promise<App> {
    return this.cache.computeIfAbsent(`apps:${id}`, () => this.database.builder(this.tableName)
      .select('*')
      .where({ id })
      .first());
  }

  public async getIDByClientID(client_id: string): Promise<number | null> {
    return this.cache.computeIfAbsent(`apps_idClientID:${client_id}`, async () => (
      await this.database.builder(this.tableName)
        .select('id')
        .where({ client_id })
        .first())?.id);
  }

  /**
   * Get a user by Email
   * @param email email of user
   * @returns User object if exists, else null
   */
  public async getByClientID(client_id: string): Promise<App | null> {
    const id = await this.getIDByClientID(client_id);
    if (!id) return null;
    return this.getById(id);
  }
}

export default new AppDAO(services.database, services.cache);
