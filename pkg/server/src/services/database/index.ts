import knex, { Knex } from 'knex';

export default class DatabaseService {
  private _builder: Knex;

  constructor(client: string, connection: {
    filename?: string,
    database?: string,
    host?: string,
    username?: string,
    password?: string
  }) {
    this._builder = knex({
      client,
      connection,
    });
  }

  get builder() {
    return this._builder;
  }
}
