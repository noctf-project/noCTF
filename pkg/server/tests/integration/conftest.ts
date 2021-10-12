import tape from 'tape';
import { init } from '../../src/server';

import type _ from '../../src/types';
import UserDAO from '../../src/models/User';
import { createSession } from '../../src/util/session';

async function makeUser(user: { name: string, password: string, email: string }) {
  const newUser = await UserDAO.create({ name: user.name, email: user.email });
  await UserDAO.setPassword(newUser.id, user.password);
  return { user: newUser, token: await createSession(newUser.id, 0, []) };
}

export const bootstrap = (() => {
  const app = init();
  tape.onFinish(async () => (await app).close());

  return async (t: tape.Test) => ({
    app: await app,
    fixtures: {
      makeUser,
    },
    scope: {
      test: t,
    },
  });
})();
