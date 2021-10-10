// Update with your config settings.

module.exports = {
  development: {
    client: process.env.NOCTF_DATABASE_CLIENT || 'sqlite3',
    connection: {
      filename: process.env.NOCTF_DATABASE_CONNECTION_FILENAME || '../../data/noctf.db',
      host:     process.env.NOCTF_DATABASE_CONNECTION_HOST || 'postgres',
      database: process.env.NOCTF_DATABASE_CONNECTION_NAME || 'noctf',
      user:     process.env.NOCTF_DATABASE_CONNECTION_USERNAME || 'noctf',
      password: process.env.NOCTF_DATABASE_CONNECTION_PASSWORD || 'devpassword'
    },
    pool: {
      min: 2,
      max: 4
    },
    migrations: {
      tableName: 'knex_migrations'
    }
  },

  staging: {
    client: 'postgresql',
    connection: {
      database: 'my_db',
      user:     'username',
      password: 'password'
    },
    pool: {
      min: 2,
      max: 10
    },
    migrations: {
      tableName: 'knex_migrations'
    }
  },

  production: {
    client: 'postgresql',
    connection: {
      database: 'my_db',
      user:     'username',
      password: 'password'
    },
    pool: {
      min: 2,
      max: 10
    },
    migrations: {
      tableName: 'knex_migrations'
    }
  }
};
