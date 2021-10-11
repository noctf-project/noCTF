import test from 'tape';
import { bootstrap } from '../conftest';


test('/login', async t => {
    const { app } = await bootstrap(t);

    const TEST_USERNAME = 'login-test-username';
    const TEST_EMAIL    = 'login-test@example.com';

    // Register a user
    const response = await app.inject({
        method: 'post',
        path: '/api/auth/register',
        payload: JSON.stringify({
            name: TEST_USERNAME,
            email: TEST_EMAIL,
        }),
        headers: {'content-type': 'application/json'}
    });
    const data = response.json();

    t.equal(response.statusCode, 200);
});