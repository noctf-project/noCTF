import { Knex } from "knex";
import { now } from "../tools/migrations/utils";


export async function up(knex: Knex): Promise<void> {
    await knex.schema.createTable('challenges', (table) => {
        table.increments('id').primary().comment('fixed challenge id');

        table.string('name').notNullable();
        table.string('category').notNullable();
        table.string('description').notNullable();

        table.json('attachments').notNullable().defaultTo('[]').comment('application defined list of attachments');

        table.integer('score_initial').notNullable().comment('Initial or maximum score. Set to desired score for static scoring');
        table.integer('score_decay').notNullable().comment('Dynamic score decay. Set to INT32_MAX for static scoring');
        table.integer('score_minimum').notNullable().comment('Minimum score. Set to 0 for static scoring');

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
        table.integer('cost').notNullable().defaultTo(0);
        table.json('attachments').notNullable().defaultTo('[]').comment('application defined list of attachments');

        table.bigInteger('released_at').notNullable().comment('time the hint should be displayed, null if the hint is hidden');

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
}


export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTable('submissions');
    await knex.schema.dropTable('hints');
    await knex.schema.dropTable('flags');
    await knex.schema.dropTable('challenges');
}

