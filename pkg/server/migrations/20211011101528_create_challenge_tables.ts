import { Knex } from "knex";
import { now } from "../tools/migrations/utils";


export async function up(knex: Knex): Promise<void> {
    await knex.schema.createTable('challenges', (table) => {
        table.increments('id').primary().comment('fixed challenge id');

        table.string('name').notNullable();
        table.string('category').notNullable();
        table.string('description').notNullable();

        table.json('attachments').notNullable().defaultTo('[]').comment('application defined list of attachments');

        table.json('score').notNullable().comment('Scoring configuration, requires {"initial":0,"decay":0,"minimum":0}');

        table.bigInteger('display_at').comment('time the challenge should be displayed, null if challenge is hidden');

        table.bigInteger('created_at').notNullable().defaultTo(now(knex));
        table.bigInteger('updated_at').notNullable().defaultTo(now(knex));
    });

    await knex.schema.createTable('flags', (table) => {
        table.increments('id').primary();
        table.integer('challenge_id').notNullable();

        table.string('flag').notNullable().comment('flag to match against');

        table.bigInteger('created_at').notNullable().defaultTo(now(knex));
        table.bigInteger('updated_at').notNullable().defaultTo(now(knex));

        table.foreign('challenge_id').references('id').inTable('challenges');
    });

    await knex.schema.createTable('hints', (table) => {
        table.increments('id').primary();
        table.integer('challenge_id').notNullable();

        table.string('hint').notNullable();
        table.json('attachments').notNullable().defaultTo('[]').comment('application defined list of attachments');

        table.bigInteger('released_at').comment('time the hint should be displayed, null if the hint is hidden');

        table.bigInteger('created_at').notNullable().defaultTo(now(knex));
        table.bigInteger('updated_at').notNullable().defaultTo(now(knex));

        table.foreign('challenge_id').references('id').inTable('challenges');
    });

    await knex.schema.createTable('submissions', (table) => {
        table.increments('id').primary();
        table.integer('challenge_id').notNullable();  // denormalize for sanity

        table.string('submission').notNullable();
        table.integer('submitter').notNullable();
        // TODO: team entry when we implement teams

        table.bigInteger('submitted_at').notNullable().defaultTo(now(knex));

        table.foreign('challenge_id').references('id').inTable('challenges');
        table.foreign('submitter').references('id').inTable('users');
    });

    // Can materialize this into a table if theres a performance requirement
    await knex.schema.raw(`CREATE VIEW challenge_solves AS (${
        knex.select(
            'flag.id as flag_id',
            'flag.challenge_id',
            'submissions.submission',
            'submissions.submitter',
            'submissions.submitted_at'
        )
        .from('submissions')
        .innerJoin('flags', 'flags.flag', 'submissions.submission')
    })`);

    const roles = (await knex('roles')
        .select('id', 'name'))
        .reduce((prev, cur) => ({ ...prev, [cur.name]: cur.id }), {});
    await knex('role_permissions').insert([
        { role_id: roles.default, permission: 'challenge.*.read' },
        { role_id: roles.default, permission: 'submissions.write' },
    ])
}


export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTable('submissions');
    await knex.schema.dropTable('hints');
    await knex.schema.dropTable('flags');
    await knex.schema.dropTable('challenges');
    await knex.raw('DROP VIEW challenge_solves');
}

