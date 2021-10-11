import { init } from "../../src/server";
import tape from 'tape';

import _types from '../../src/types';
import UserDAO from "../../src/models/User";
import { createSession } from "../../src/util/session";

async function makeUser(user: {name: string, password: string, email: string}) {
    const newUser = await UserDAO.create({name: user.name, email: user.email});
    await UserDAO.setPassword(newUser.id, user.password);
    return { user: newUser, token: await createSession(newUser.id) };
}

export const bootstrap = (() => {
    const app = init();
    tape.onFinish(async () => await (await app).close());

    return async (t: tape.Test) => {
        return {
            app: await app,
            fixtures: {
                makeUser,
            }
        };
    }
})();