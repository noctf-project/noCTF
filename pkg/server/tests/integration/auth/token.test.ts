import test from 'tape';
import { bootstrap } from '../conftest';


test('/token', async t => {
    const { app, fixtures } = await bootstrap(t);
    const { token: userToken } = await fixtures.makeUser({
        name: 'token-test-username',
        password: 'token-test-password',
        email: 'token-test@example.com'
    });

    t.test('invalid token', async t => {
        const token = await app.inject({
            method: 'post',
            path: '/api/auth/token',
            payload: JSON.stringify({
                refresh_token: 'invalidinvalidinvalidinvalidinvalid',
                grant_type: 'refresh_token',
                client_id: 'default',
            }),
            headers: {'content-type': 'application/json'}
        });
        t.equal(token.statusCode, 401);
        t.match(token.json().error, /.+/);
    });

    t.skip('3rd part apps');

    t.test('token', async t => {
        const token = await app.inject({
            method: 'post',
            path: '/api/auth/token',
            payload: JSON.stringify({
                refresh_token: userToken.refresh,
                grant_type: 'refresh_token',
                client_id: 'default',
            }),
            headers: {'content-type': 'application/json'}
        });
        t.equal(token.statusCode, 200);
        t.match(token.json().access_token, /.+/);
    });
});

test.skip('/reset', async t => {});

test('/permissions', async t => {
    const { app, fixtures } = await bootstrap(t);
    const { token } = await fixtures.makeUser({
        name: 'permissions-test-username',
        password: 'permissions-test-password',
        email: 'permissions-test@example.com'
    });

    t.test('unauthed', async t => {
        const perms = await app.inject({
            path: '/api/auth/permissions'
        });
        t.equal(perms.statusCode, 200);
        t.deepEqual(perms.json(), {permissions: ['auth.public.login', 'auth.public.register']});
    });

    t.test('authed', async t => {
        const perms = await app.inject({
            path: '/api/auth/permissions',
            headers: {authorization: `Bearer ${token.access}`}
        });
        t.equal(perms.statusCode, 200);
        t.deepEqual(perms.json(), {permissions: ['auth.self.*']});
    });
});

test('/logout', async t => {
    const { app, fixtures } = await bootstrap(t);
    const { token } = await fixtures.makeUser({
        name: 'logout-test-username',
        password: 'logout-test-password',
        email: 'logout-test@example.com'
    });

    const logout = await app.inject({
        method: 'post',
        path: '/api/auth/logout',
        headers: {authorization: `Bearer ${token.access}`}
    });
    t.equal(logout.statusCode, 200);

    // Check revoke worked
    const refresh = await app.inject({
        method: 'post',
        path: '/api/auth/token',
        payload: JSON.stringify({
            refresh_token: token.refresh,
            grant_type: 'refresh_token',
            client_id: 'default',
        }),
        headers: {'content-type': 'application/json'}
    });
    t.equal(refresh.statusCode, 401);
});
