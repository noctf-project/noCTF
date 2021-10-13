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

  await knex.schema.createTable('clients', (table) => {
    table.increments('id').primary();
    table.string('name', 48).notNullable();
    table.string('description').notNullable();
    table.string('oauth_client_id').notNullable().unique();
    table.string('oauth_client_secret_hash').notNullable();
    table.string('oauth_origins');
    table.boolean('enabled').notNullable();
  });

  await knex.schema.createTable('user_sessions', (table) => {
    table.string('session_hash').primary();
    table.integer('user_id').references('id').inTable('users');
    table.bigInteger('created_at').notNullable().defaultTo(now(knex));
    table.bigInteger('expires_at');
    table.bigInteger('revoked_at');
    table.bigInteger('touched_at').defaultTo(now(knex));
    table.string('scope').notNullable();
    table.integer('client_id').references('id').inTable('clients');
    table.index(['client_id']);
  });

  await knex.schema.createTable('roles', (table) => {
    table.increments('id').primary();
    table.string('name', 48).unique().notNullable();
    table.bigInteger('created_at').notNullable().defaultTo(now(knex));
  });

  await knex.schema.createTable('user_roles', (table) => {
    table.integer('user_id').notNullable().references('id').inTable('users');
    table.integer('role_id').notNullable().references('id').inTable('roles');
    table.bigInteger('created_at').notNullable().defaultTo(now(knex));
    table.unique(['user_id', 'role_id']);
    table.index(['role_id']);
  });


  await knex.schema.createTable('role_permissions', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('created_at').notNullable().defaultTo(now(knex));
    table.integer('role_id').references('id').inTable('roles');
    table.string('permission').notNullable();
    table.index(['role_id', 'permission'], 'idx_role_id_permission');
  });

  await knex('roles').insert([
    { name: 'public' },
    { name: 'default' },
    { name: 'admin' },
  ]);
  const roles = (await knex('roles')
    .select('id', 'name'))
    .reduce((prev, cur) => ({ ...prev, [cur.name]: cur.id }), {});

  await knex('role_permissions').insert([
    { role_id: roles.public, permission: 'auth.public.login' },
    { role_id: roles.public, permission: 'auth.public.register' },
    { role_id: roles.default, permission: 'auth.self.*' },
    { role_id: roles.admin, permission: '*' }
  ]);
}


export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('role_permissions');
  await knex.schema.dropTable('user_roles');
  await knex.schema.dropTable('roles');
  await knex.schema.dropTable('user_sessions');
  await knex.schema.dropTable('clients');
  await knex.schema.dropTable('users');
}

