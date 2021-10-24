import { Knex } from "knex";
import { now } from "../../tools/migrations/utils";

export async function seed(knex: Knex): Promise<void> {
    const roles = (await knex('roles')
        .select('id', 'name'))
        .reduce((prev, cur) => ({ ...prev, [cur.name]: cur.id }), {});

    const TEST_USERS = [
        {id:  1, email: 'admin@noctf.dev',      name: 'ready_player_1'},
        {id:  2, email: 'reserved+2@noctf.dev', name: 'reserved_player_2'},
        {id:  3, email: 'reserved+3@noctf.dev', name: 'reserved_player_3'},
        {id:  4, email: 'reserved+4@noctf.dev', name: 'reserved_player_4'},
        {id:  5, email: 'reserved+5@noctf.dev', name: 'reserved_player_5'},
        {id:  6, email: 'reserved+6@noctf.dev', name: 'reserved_player_6'},
        {id:  7, email: 'reserved+7@noctf.dev', name: 'reserved_player_7'},
        {id:  8, email: 'reserved+8@noctf.dev', name: 'reserved_player_8'},
        {id:  9, email: 'reserved+9@noctf.dev', name: 'reserved_player_9'},

        {id: 10, email: 'odot@players.noctf.dev', name: 'odot'},
        {id: 11, email: 'obot@players.noctf.dev', name: 'obot'},
        {id: 12, email: 'opot@players.noctf.dev', name: 'opot'},
        {id: 13, email: 'oqot@players.noctf.dev', name: 'oqot'},
    ];
    const TEST_USER_ROLES = [
        // Reserved users aren't assigned roles at the moment, assign them as we find uses for these low-id users
        {user_id:  1, role_id: roles.admin },
        {user_id: 10, role_id: roles.default },
        {user_id: 11, role_id: roles.default },
        {user_id: 12, role_id: roles.default },
        {user_id: 13, role_id: roles.default },
    ]

    // Truncate everything
    await knex.raw("TRUNCATE users CASCADE");
    await knex.raw("TRUNCATE user_roles CASCADE");

    // Reset sequences
    await knex.raw(`ALTER SEQUENCE users_id_seq RESTART WITH ${1+TEST_USERS.length}`);

    // Basic cases
    await knex("users").insert(TEST_USERS);
    await knex("user_roles").insert(TEST_USER_ROLES);
};
