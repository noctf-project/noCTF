import test from 'tape';
import { bootstrap } from '../conftest';


test('/register', async t => {
    const { app } = await bootstrap(t);

    const TEST_USERNAME = 'register-test-username';
    const TEST_EMAIL    = 'register-test@example.com';

    // Create a new user
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
    t.match(data.token, /.+/);

    t.test('a taken email', async t => {
        const response = await app.inject({
            method: 'post',
            path: '/api/auth/register',
            payload: JSON.stringify({
                name: TEST_USERNAME + Date.now().toString(),
                email: TEST_EMAIL,
            }),
            headers: {'content-type': 'application/json'}
        });

        t.equal(response.statusCode, 409);
        t.equal(response.json().detail?.key, 'email');
    });

    t.test('a taken username', async t => {
        const response = await app.inject({
            method: 'post',
            path: '/api/auth/register',
            payload: JSON.stringify({
                name: TEST_USERNAME,
                email: TEST_EMAIL + Date.now().toString(),
            }),
            headers: {'content-type': 'application/json'}
        });

        t.equal(response.statusCode, 409);
        t.equal(response.json().detail?.key, 'name');
    });
});

test('/register/check', t => { t.skip("We should refactor this endpoint as some point"); t.end(); })

test('/verify', async t => {
    const { app } = await bootstrap(t);

    const TEST_USERNAME = 'verify-test-username';
    const TEST_PASSWORD = 'verify-test-password';
    const TEST_EMAIL    = 'verify-test@example.com';

    const register = await app.inject({
        method: 'post',
        path: '/api/auth/register',
        payload: JSON.stringify({
            name: TEST_USERNAME,
            email: TEST_EMAIL + Date.now().toString(),
        }),
        headers: {'content-type': 'application/json'}
    });
    const { token: registerToken } = register.json();
    t.equal(register.statusCode, 200);
    t.assert(registerToken, "No register token");

    const verifyInvalid = await app.inject({
        method: 'post',
        path: '/api/auth/verify',
        payload: JSON.stringify({
            token: 'invalid',
            password: TEST_PASSWORD,
        }),
        headers: {'content-type': 'application/json'}
    });
    t.equal(verifyInvalid.statusCode, 401);
    t.match(verifyInvalid.json().error, /.+/);

    const verifySuccess = await app.inject({
        method: 'post',
        path: '/api/auth/verify',
        payload: JSON.stringify({
            token: registerToken,
            password: TEST_PASSWORD,
        }),
        headers: {'content-type': 'application/json'}
    });
    const data = verifySuccess.json();
    t.equal(verifySuccess.statusCode, 200);
    t.match(data.access_token, /.+/);
    t.match(data.refresh_token, /.+/);
    t.equal(typeof data.expires, "number");

    const verifyReuse = await app.inject({
        method: 'post',
        path: '/api/auth/verify',
        payload: JSON.stringify({
            token: registerToken,
            password: TEST_PASSWORD,
        }),
        headers: {'content-type': 'application/json'}
    });
    t.equal(verifyReuse.statusCode, 401);
    t.match(verifyReuse.json().error, /.+/);
})