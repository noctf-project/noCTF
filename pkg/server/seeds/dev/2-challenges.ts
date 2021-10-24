import { Knex } from "knex";
import { now } from "../../tools/migrations/utils";

export async function seed(knex: Knex): Promise<void> {
    const makeDefaultedChallenge = (chal: Record<string, unknown>) => ({
        id: 0,
        name: 'Unnamed Challenge',
        category: 'test',
        description: 'This is a default challenge',
        attachments: JSON.stringify([]),
        score: JSON.stringify({initial: 500, decay: 100, minimum: 100}),
        tags: JSON.stringify([]),
        display_at: now(knex),
        ...chal
    });
    const TEST_CHALLENGES = [
        makeDefaultedChallenge({ id: 1, name: 'Basic Challenge', description: 'This challenge has no hints or attachments' }),

        makeDefaultedChallenge({ id: 2, name: '1-Hinted Challenge', description: 'This challenge has 1 hint' }),
        makeDefaultedChallenge({ id: 3, name: 'Many-Hinted Challenge', description: 'This challenge has 3 hints' }),

        makeDefaultedChallenge({ id: 4, name: 'Multi-Flag Challenge', description: 'This challenge has 2 flags' }),

        makeDefaultedChallenge({
            id: 5,
            name: '1-Attached Challenge',
            description: 'This challenge has 1 attachment',
            attachments: JSON.stringify([{ name: 'src.zip', uri: 'file:///tmp/src.zip' }]),
        }),
        makeDefaultedChallenge({
            id: 6,
            name: 'Many-Attached Challenge',
            description: 'This challenge has 3 attachments',
            attachments: JSON.stringify([
                { name: 'src.zip', uri: 'file:///tmp/src.zip' },
                { name: 's3.zip', uri: 's3://noctf/src.zip' },
                { name: 'gcs.zip', uri: 'gcs://noctf/src.zip' },
            ]),
        }),

        makeDefaultedChallenge({ id: 7, name: 'Unsolvable Challenge', description: 'This challenge has some submissions but no solves' }),
        makeDefaultedChallenge({ id: 8, name: 'All-Solves Challenge', description: 'This challenge has no incorrect submissions and solves' }),
        makeDefaultedChallenge({ id: 9, name: 'Some-Solves Challenge', description: 'This challenge has incorrect submissions and solves' }),

        makeDefaultedChallenge({
            id: 10,
            name: 'Statically-Scored Challenge',
            description: 'This challenge has static scoring',
            score: JSON.stringify({
                initial: 500,
                decay: 1000000,
                minimum: 0,
            }),
        }),

        makeDefaultedChallenge({ id: 11, name: 'Hidden Challenge', description: 'This challenge is hidden', display_at: null }),
        makeDefaultedChallenge({ id: 12, name: 'Tagged Challenge', description: 'This challenge has tags', tags: JSON.stringify([{key: "Difficulty", value: "Easy"}])}),
    ];
    const TEST_FLAGS = TEST_CHALLENGES.map((c, id) => ({
        id: id,
        challenge_id: c.id,
        flag: `NOCTF_DEV{flag_for_chal_${c.id}}`
    })).concat([
        {id: TEST_CHALLENGES.length + 1, challenge_id: 4, flag: 'NOCTF_DEV{second_flag_for_chal_4}'},
        {id: TEST_CHALLENGES.length + 2, challenge_id: 4, flag: 'NOCTF_DEV{third_flag_for_chal_4}'},
    ]);
    const TEST_HINTS = [
        {id: 1, challenge_id: 2, hint: 'This is a single hint', released_at: now(knex)},
        {id: 2, challenge_id: 3, hint: 'This is a normal hint (1/3)', released_at: now(knex)},
        {id: 3, challenge_id: 3, hint: 'This is a hint with attachments (2/3)', attachments: JSON.stringify([{name: "src.zip", uri: "file:///tmp/src.zip"}]), released_at: now(knex)},
        {id: 4, challenge_id: 3, hint: 'This is a hidden hint (3/3)', released_at: null},
    ];
    const TEST_SUBMISSIONS = [
        // Correct submissions
        {id:  1, challenge_id: 8, submission: 'NOCTF_DEV{flag_for_chal_8}', submitter: 10},
        {id:  2, challenge_id: 8, submission: 'NOCTF_DEV{flag_for_chal_8}', submitter: 11},
        {id:  3, challenge_id: 8, submission: 'NOCTF_DEV{flag_for_chal_8}', submitter: 12},
        {id:  4, challenge_id: 8, submission: 'NOCTF_DEV{flag_for_chal_8}', submitter: 10},  // Submitting to already solved chal

        {id:  5, challenge_id: 9, submission: 'noctf_dev{flag_for_chal_9}', submitter: 10},
        {id:  6, challenge_id: 9, submission: 'noctf_dev{flag_for_chal_9}', submitter: 11},

        // Incorrect submissions
        {id:  7, challenge_id: 7, submission: 'INCORRECT',  submitter: 10},
        {id:  8, challenge_id: 7, submission: 'UNCORRECT',  submitter: 10},
        {id:  9, challenge_id: 7, submission: 'NOTCORRECT', submitter: 11},
        {id: 10, challenge_id: 7, submission: 'NONCORRECT', submitter: 12},
        {id: 11, challenge_id: 7, submission: 'CORRECTNT',  submitter: 10},

        {id: 12, challenge_id: 9, submission: 'SOLVE_ATTEMPT_1', submitter: 10},
        {id: 13, challenge_id: 9, submission: 'SOLVE_ATTEMPT_2', submitter: 10},
        {id: 14, challenge_id: 9, submission: 'SOLVE_ATTEMPT_3', submitter: 10},
        {id: 15, challenge_id: 9, submission: 'SOLVE_ATTEMPT_4', submitter: 10},
        {id: 16, challenge_id: 9, submission: 'I_TRIED',         submitter: 11},
        {id: 17, challenge_id: 9, submission: 'TOO_HARD_HALP',   submitter: 12},  // 2 never solved it
    ];

    // Truncate everything
    await knex.raw("TRUNCATE submissions CASCADE");
    await knex.raw("TRUNCATE hints CASCADE");
    await knex.raw("TRUNCATE flags CASCADE");
    await knex.raw("TRUNCATE challenges CASCADE");

    // Reset sequences
    await knex.raw(`ALTER SEQUENCE submissions_id_seq RESTART WITH ${1+TEST_SUBMISSIONS.length}`);
    await knex.raw(`ALTER SEQUENCE hints_id_seq       RESTART WITH ${1+TEST_HINTS.length}`);
    await knex.raw(`ALTER SEQUENCE flags_id_seq       RESTART WITH ${1+TEST_FLAGS.length}`);
    await knex.raw(`ALTER SEQUENCE challenges_id_seq  RESTART WITH ${1+TEST_CHALLENGES.length}`);

    // Basic cases
    await knex("challenges").insert(TEST_CHALLENGES);
    await knex("flags").insert(TEST_FLAGS);
    await knex("hints").insert(TEST_HINTS);
    await knex("submissions").insert(TEST_SUBMISSIONS);
};
