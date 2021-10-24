import { Knex } from "knex";
import { now } from "../tools/migrations/utils";


export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('users', (table) => {
    table.increments('id').primary();
    table.bigInteger('created_at').notNullable().defaultTo(now(knex));
    table.boolean('banned').notNullable().defaultTo(false);
    table.string('email', 256).unique().notNullable();
    table.string('name', 48).unique().notNullable();
    table.string('verify_hash');
    table.string('password');
  });

  await knex.schema.createTable('apps', (table) => {
    table.increments('id').primary();
    table.string('name', 48).notNullable();
    table.string('description').notNullable();
    table.string('client_id', 48).notNullable().unique();
    table.string('client_secret_hash').notNullable();
    table.string('allowed_redirect_uris').notNullable();
    table.boolean('enabled').notNullable();
    table.bigInteger('created_at').notNullable().defaultTo(now(knex));
  });

  await knex.schema.createTable('scopes', (table) => {
    table.increments('id').primary();
    table.string('name', 32).notNullable();
    table.string('description').notNullable();
    table.string('permissions').notNullable();
    table.bigInteger('created_at').notNullable().defaultTo(now(knex));
  });

  await knex.schema.createTable('user_sessions', (table) => {
    table.string('session_hash').primary();
    table.integer('user_id').references('id').inTable('users');
    table.bigInteger('created_at').notNullable().defaultTo(now(knex));
    table.bigInteger('expires_at');
    table.bigInteger('revoked_at');
    table.bigInteger('touched_at').defaultTo(now(knex));
    table.string('scope').notNullable();
    table.integer('app_id').references('id').inTable('apps');
    table.index(['app_id', 'touched_at']);
  });

  await knex.schema.createTable('roles', (table) => {
    table.increments('id').primary();
    table.string('name', 48).unique().notNullable();
    table.string('description', 255).notNullable();
    table.string('permissions').notNullable();
    table.bigInteger('created_at').notNullable().defaultTo(now(knex));
  });

  await knex.schema.createTable('user_roles', (table) => {
    table.integer('user_id').notNullable().references('id').inTable('users');
    table.integer('role_id').notNullable().references('id').inTable('roles');
    table.bigInteger('created_at').notNullable().defaultTo(now(knex));
    table.unique(['user_id', 'role_id']);
    table.index(['role_id']);
  });
  
  await knex.schema.createTable('app_roles', (table) => {
    table.integer('app_id').notNullable().references('id').inTable('apps');
    table.integer('role_id').notNullable().references('id').inTable('roles');
    table.bigInteger('created_at').notNullable().defaultTo(now(knex));
    table.unique(['app_id', 'role_id']);
    table.index(['role_id']);
  });

  await knex('roles').insert([
    {
      name: 'public',
      description: 'Unautheticated users, do not delete.',
      permissions: 'auth.public.login,auth.public.register'
    },
    {
      name: 'default',
      description: 'Default user permission, do not delete.',
      permissions: 'auth.self.*'
    },
    {
      name: 'admin',
      description: 'Superuser. Do not delete.',
      permissions: '*'
    },
  ]);

  await knex('scopes').insert([
    {
      name: 'api-full',
      description: '(Almost) full API access to your account.',
      permissions: '*'
    },
    {
      name: 'profile',
      description: 'Read-only access to your profile.',
      permissions: 'profile.self.view',
    }
  ]);
}


export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('user_roles');
  await knex.schema.dropTable('roles');
  await knex.schema.dropTable('user_sessions');
  await knex.schema.dropTable('scopes');
  await knex.schema.dropTable('app_roles');
  await knex.schema.dropTable('apps');
  await knex.schema.dropTable('users');
}

