import { sql, type Kysely } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema.createSchema('core').execute();
  
  await db.schema
    .createTable('core.user')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('name', 'varchar(64)', (col) => col.unique().notNull())
    .addColumn('bio', 'varchar')
    .addColumn('created_at', 'timestamp', (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .execute();

  await db.schema
    .createTable('core.user_auth')
    .addColumn('user_id', 'integer', (col) => col.notNull().references('core.user.id'))
    .addColumn('provider', 'varchar(64)', (col) => col.notNull())
    .addColumn('provider_id', 'varchar', (col) => col.notNull())
    .addColumn('secret_data', 'varchar')
    .addColumn('is_active', 'boolean', (col) => col.notNull().defaultTo(true))
    .addColumn('is_verified', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('is_hidden', 'boolean', (col) => col.notNull().defaultTo(false))
    .addUniqueConstraint('uidx_user_id_provider_idx', ['user_id', 'provider'])
    .addUniqueConstraint('uidx_provider_provider_id_idx', ['provider', 'provider_id'])
    .addColumn('created_at', 'timestamp', (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .execute();

  await db.schema
    .createTable('core.oauth_provider')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('is_enabled', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('is_create_user', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('name', 'varchar(56)', (col) => col.unique())
    .addColumn('client_id', 'varchar', (col) => col.notNull())
    .addColumn('client_secret', 'varchar', (col) => col.notNull())
    .addColumn('image_src', 'varchar')
    .addColumn('redirect_uri', 'varchar', (col) => col.notNull())
    .addColumn('token_uri', 'varchar', (col) => col.notNull())
    .addColumn('info_uri', 'varchar', (col) => col.notNull())
    .addColumn('info_id_property', 'varchar')
    .addColumn('created_at', 'timestamp', (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .execute();

  await db.schema
    .createIndex('core.oauth_provider_idx_is_enabled')
    .on('core.oauth_provider')
    .column('is_enabled')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex('core.oauth_provider_idx_is_enabled').execute();
  await db.schema.dropTable('core.oauth_provider').execute();
  await db.schema.dropTable('core.user_auth').execute();
  await db.schema.dropTable('core.user').execute();
}
