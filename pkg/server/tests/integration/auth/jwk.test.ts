import test from 'tape';
import { bootstrap } from '../conftest';

test('/jwks', async (t) => {
  const { app } = await bootstrap(t);

  const response = await app.inject({
    method: 'get',
    path: '/api/auth/jwks',
  });
  const data = response.json();

  t.equal(response.statusCode, 200);
  t.assert(data.keys instanceof Array, 'response keys is not an array');
});
