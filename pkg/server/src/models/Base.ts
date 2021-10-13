import CacheService from '../services/cache';
import DatabaseService from '../services/database';

export default class BaseDAO {
  protected tableName = 'base';

  constructor(protected database: DatabaseService, protected cache: CacheService) {
  }
}
