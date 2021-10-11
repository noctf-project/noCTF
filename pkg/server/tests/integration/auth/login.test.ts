import test from 'tape';
import { bootstrap } from '../conftest';


test('/login', async t => {
    const { app } = await bootstrap(t);

    const TEST_USERNAME = 'login-test-username';
    const TEST_PASSWORD = 'login-test-password';
    const TEST_EMAIL    = 'login-test@example.com';

    // Register a user
    const register = await app.inject({
        method: 'post',
        path: '/api/auth/register',
        payload: JSON.stringify({
            name: TEST_USERNAME,
            email: TEST_EMAIL,
        }),
        headers: {'content-type': 'application/json'}
    });
    const { token } = register.json();
    t.equal(register.statusCode, 200);
    t.assert(token, "no register token");

    const loginRequiresVerification = await app.inject({
        method: 'post',
        path: '/api/auth/login',
        payload: JSON.stringify({
            email: TEST_EMAIL,
            password: TEST_PASSWORD
        }),
        headers: {'content-type': 'application/json'}
    });
    t.equal(loginRequiresVerification.statusCode, 401);
    t.match(loginRequiresVerification.json().error, /account not activated/i);

    const verify = await app.inject({
        method: 'post',
        path: '/api/auth/verify',
        payload: JSON.stringify({
            token,
            password: TEST_PASSWORD,
        }),
        headers: {'content-type': 'application/json'}
    });
    t.equal(verify.statusCode, 200);

    t.test('non-existent user', async t => {
        const login = await app.inject({
            method: 'post',
            path: '/api/auth/login',
            payload: JSON.stringify({
                email: 'nonexistent@example.com',
                password: 'irrelevant'
            }),
            headers: {'content-type': 'application/json'}
        });
        t.equal(login.statusCode, 401);
        t.match(login.json().error, /invalid credentials/);
    })

    t.test('invalid password', async t => {
        const login = await app.inject({
            method: 'post',
            path: '/api/auth/login',
            payload: JSON.stringify({
                email: TEST_EMAIL,
                password: 'invalid'
            }),
            headers: {'content-type': 'application/json'}
        });
        t.equal(login.statusCode, 401);
        t.match(login.json().error, /invalid credentials/);
    });

    t.test('can login', async t => {
        const login = await app.inject({
            method: 'post',
            path: '/api/auth/login',
            payload: JSON.stringify({
                email: TEST_EMAIL,
                password: TEST_PASSWORD
            }),
            headers: {'content-type': 'application/json'}
        });
        const data = login.json();
        t.equal(login.statusCode, 200);
        t.match(data.access_token, /.+/);
        t.match(data.refresh_token, /.+/);
        t.equal(typeof data.expires, "number");
    });
});