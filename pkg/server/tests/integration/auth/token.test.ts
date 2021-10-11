import test from 'tape';
import { bootstrap } from '../conftest';


test('/refresh', async t => {
    const { app, fixtures } = await bootstrap(t);
    const { token } = await fixtures.makeUser({
        name: 'refresh-test-username',
        password: 'refresh-test-password',
        email: 'refresh-test@example.com'
    });

    t.test('invalid refresh token', async t => {
        const refresh = await app.inject({
            method: 'post',
            path: '/api/auth/refresh',
            payload: JSON.stringify({
                token: 'invalidinvalidinvalidinvalidinvalid'
            }),
            headers: {'content-type': 'application/json'}
        });
        t.equal(refresh.statusCode, 401);
        t.match(refresh.json().error, /.+/);
    });

    t.skip('3rd part apps');

    t.test('refresh', async t => {
        const refresh = await app.inject({
            method: 'post',
            path: '/api/auth/refresh',
            payload: JSON.stringify({
                token: token.refresh
            }),
            headers: {'content-type': 'application/json'}
        });
        t.equal(refresh.statusCode, 200);
        t.match(refresh.json().access_token, /.+/);
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
        path: '/api/auth/refresh',
        payload: JSON.stringify({
            token: token.refresh
        }),
        headers: {'content-type': 'application/json'}
    });
    t.equal(refresh.statusCode, 401);
});
