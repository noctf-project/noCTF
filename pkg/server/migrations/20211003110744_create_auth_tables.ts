import { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('users', (table) => {
    table.increments('id').primary();
    table.dateTime('created_at').notNullable().defaultTo(knex.fn.now());
    table.boolean('banned').notNullable().defaultTo(false);
    table.string('email', 256).unique().notNullable();
    table.string('name', 48).unique().notNullable();
    table.string('password');
  });

  await knex.schema.createTable('clients', (table) => {
    table.increments('id').primary();
    table.string('name', 48).notNullable();
    table.string('description').notNullable();
    table.string('oauth_client_id').notNullable().unique();
    table.string('oauth_client_secret').notNullable();
    table.boolean('enabled').notNullable();
  });

  await knex.schema.createTable('user_sessions', (table) => {
    table.string('session_hash').primary();
    table.integer('user_id').references('id').inTable('users');
    table.dateTime('created_at').notNullable().defaultTo(knex.fn.now());
    table.dateTime('expires_at');
    table.dateTime('revoked_at');
    table.string('scope').notNullable();
    table.integer('client_id').notNullable().references('id').inTable('clients');
  });

  await knex.schema.createTable('roles', (table) => {
    table.integer('id').primary();
    table.string('name', 48).unique().notNullable();
    table.dateTime('created_at').notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('role_permissions', (table) => {
    table.bigIncrements('id').primary();
    table.dateTime('created_at').notNullable().defaultTo(knex.fn.now());
    table.integer('role_id').references('id').inTable('roles');
    table.string('permission', 256).notNullable();
    table.index(['role_id', 'permission'], 'idx_role_id_permission');
  });

  await knex('roles').insert([{ name: 'public' }, { name: 'default' }]);
  const { id: publicRoleId } = (await knex('roles')
    .select('id')
    .where('name', 'public'))[0];
  const { id: defaultRoleId } = (await knex('roles')
    .select('id')
    .where('name', 'default'))[0];

  await knex('role_permissions').insert([
    { role_id: publicRoleId, permission: 'auth.public.login' },
    { role_id: publicRoleId, permission: 'auth.public.register' },
    { role_id: publicRoleId, permission: 'auth.public.verify' },
    { role_id: defaultRoleId, permission: 'auth.self.*' }
  ]);
}


export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('role_permissions');
  await knex.schema.dropTable('roles');
  await knex.schema.dropTable('user_sessions');
  await knex.schema.dropTable('users');
}

