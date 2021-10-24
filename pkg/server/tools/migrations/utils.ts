import { Knex } from "knex";

export const now = (knex: Knex) => {
    switch(knex.client.config.client) {
        case 'sqlite3':
            return knex.raw('(strftime(\'%s\', \'now\'))');
        case 'mysql':
            return knex.raw('(UNIX_TIMESTAMP())');
        case 'postgresql':
            return knex.raw('(extract(epoch from now()))');
        default:
            throw new Error(`Unknown db type ${knex.client.config.client}`);
    }
};