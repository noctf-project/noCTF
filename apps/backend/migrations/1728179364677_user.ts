import { sql, type Kysely } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema.createSchema('core').execute();
  
  const schema = db.schema.withSchema('core');

  await schema
    .createTable('user')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('name', 'varchar(64)', (col) => col.unique())
    .addColumn('bio', 'varchar')
    .addColumn('is_blocked', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('is_hidden', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('created_at', 'timestamp', (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .execute();

  await schema
    .createTable('user_auth')
    .addColumn('user_id', 'integer', (col) => col.notNull()
      .references('user.id')
      .onDelete('cascade'))
    .addColumn('provider', 'varchar(64)', (col) => col.notNull())
    .addColumn('provider_id', 'varchar', (col) => col.notNull())
    .addColumn('secret_data', 'varchar')
    .addUniqueConstraint('uidx_user_id_provider_idx', ['user_id', 'provider'])
    .addUniqueConstraint('uidx_provider_provider_id_idx', ['provider', 'provider_id'])
    .addColumn('created_at', 'timestamp', (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .execute();

  await schema
    .createTable('oauth_provider')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('name', 'varchar(56)', (col) => col.notNull().unique())
    .addColumn('is_enabled', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('is_registration_enabled', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('client_id', 'varchar', (col) => col.notNull())
    .addColumn('client_secret', 'varchar', (col) => col.notNull())
    .addColumn('image_src', 'varchar')
    .addColumn('redirect_uri', 'varchar', (col) => col.notNull())
    .addColumn('authorize_url', 'varchar', (col) => col.notNull())
    .addColumn('token_url', 'varchar', (col) => col.notNull())
    .addColumn('info_url', 'varchar', (col) => col.notNull())
    .addColumn('info_id_property', 'varchar')
    .addColumn('created_at', 'timestamp', (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .execute();

  await schema
    .withSchema('core')
    .createIndex('oauth_provider_idx_is_enabled')
    .on('oauth_provider')
    .column('is_enabled')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  const schema = db.schema.withSchema('core');

  await schema.dropIndex('oauth_provider_idx_is_enabled').execute();
  await schema.dropTable('oauth_provider').execute();
  await schema.dropTable('user_auth').execute();
  await schema.dropTable('user').execute();
  await db.schema.dropSchema('core').execute();
}
