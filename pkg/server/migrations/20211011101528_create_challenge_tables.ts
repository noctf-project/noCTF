import { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {
    await knex.schema.createTable('challenge_revisions', (table) => {
        table.comment('List of all revisions for a challenge, can support a tree like representation');

        table.increments('id').primary().comment('challenge revision id');
        table.integer('supersedes').defaultTo(null).comment('revision this revision supersedes, null if this is the first revision');

        table.string('name').notNullable().comment('challenge name');
        table.string('category').notNullable().comment('challenge category');
        table.string('description').notNullable().defaultTo('').comment('challenge description');

        table.integer('revisor').notNullable().comment('author of this revision');
        table.bigInteger('created_at').notNullable().defaultTo(knex.fn.now()).comment('when the revision was created');

        table.foreign('supersedes').references('id').inTable('challenge_revisions');
        table.foreign('revisor').references('id').inTable('users');
    }); 

    await knex.schema.createTable('challenges', (table) => {
        table.increments('id').primary().comment('fixed challenge id');
        table.integer('live_revision').notNullable().comment('current revision');

        table.bigInteger('display_at').comment('time the challenge should be displayed, null if challenge is hidden');

        table.foreign('live_revision').references('id').inTable('challenge_revisions');
    });

    await knex.schema.createTable('flags', (table) => {
        table.increments('id').primary();
        table.integer('challenge_revision').notNullable();

        table.string('flag').notNullable();

        table.foreign('challenge_revision').references('id').inTable('challenge_revisions');
    });

    await knex.schema.createTable('hints', (table) => {
        table.increments('id').primary();
        table.integer('challenge_revision').notNullable();

        table.string('hint').notNullable();
        table.integer('cost').notNullable().defaultTo(0);
        table.bigInteger('released_at');

        table.integer('publisher').notNullable();
        table.bigInteger('created_at').notNullable().defaultTo(knex.fn.now());

        table.foreign('challenge_revision').references('id').inTable('challenge_revisions');
        table.foreign('publisher').references('id').inTable('users');
    });

    await knex.schema.createTable('submissions', (table) => {
        table.increments('id').primary();
        table.integer('challenge_revision').notNullable();
        table.integer('challenge').notNullable();  // denormalize for sanity

        table.string('submission').notNullable();
        table.integer('submitter').notNullable();
        // TODO: team entry when we implement teams

        table.bigInteger('submitted_at').notNullable().defaultTo(knex.fn.now());

        table.foreign('challenge_revision').references('id').inTable('challenge_revisions');
        table.foreign('challenge').references('id').inTable('challenges');
        table.foreign('submitter').references('id').inTable('users');
    });

    await knex.schema.raw(`
        CREATE VIEW live_challenges AS (${
            knex.select(
                'c.id as challenge_id',
                'c.live_revision as revision_id',
                'c.display_at',
                'r.name',
                'r.category',
                'r.description'
            ).from('challenges as c').innerJoin('challenge_revisions as r', (j) => {
                j.on('c.live_revision', '=', 'r.id')
            })
        })
    `);
}


export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTable('challenges');
    await knex.schema.dropTable('challenge_revisions');
    await knex.schema.dropTable('challenge_history');
    await knex.schema.dropTable('flags');
    await knex.schema.dropTable('hints');
    await knex.schema.dropTable('submissions');
    await knex.schema.raw('DROP VIEW live_challenges');
}

