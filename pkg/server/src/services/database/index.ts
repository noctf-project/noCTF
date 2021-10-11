import knex, { Knex } from 'knex';
import { DatabaseError } from 'pg';
import { NoCTFDatabaseException } from '../../util/exceptions';

export default class DatabaseService {
  private _builder: Knex;

  constructor(client: string, connection: {
    filename?: string,
    database?: string,
    host?: string,
    port?: number,
    username?: string,
    password?: string
  }) {
    this._builder = knex({
      client,
      connection,
    });
  }

  builder(...args: any[]) {
    return this._builder(...args).on('error', (e: Error) => {
      if(!(e instanceof DatabaseError)) {
        throw e;
      }

      throw NoCTFDatabaseException.from(e);
    });
  }

  get rawBuilder() {
    return this._builder;
  }

  async close() {
    await this._builder.destroy();
  }
}
