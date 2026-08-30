const { test, describe, before, after, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const nock = require('nock');
const request = require('supertest');

// Set before requiring the server: it destructures these off process.env at load.
process.env.SPOTIFY_CLIENT_ID = 'test-client-id';
process.env.SPOTIFY_CLIENT_SECRET = 'test-client-secret';
process.env.SPOTIFY_CLIENT_CALLBACK_URL = 'song-updater-qa://spotify-login-callback';

const app = require('./server.js');

const SPOTIFY = 'https://accounts.spotify.com';

before(() => {
    // Block real outbound calls, but supertest still needs loopback to reach
    // the app it mounts on an ephemeral port.
    nock.disableNetConnect();
    nock.enableNetConnect('127.0.0.1');
});
after(() => {
    nock.cleanAll();
    nock.enableNetConnect();
});
afterEach(() => nock.cleanAll());

describe('GET /', () => {
    test('reports healthy', async () => {
        const response = await request(app).get('/');

        assert.equal(response.status, 200);
        assert.match(response.text, /healthy/);
    });
});

describe('POST /api/token', () => {
    test('exchanges an authorization code for tokens', async () => {
        nock(SPOTIFY)
            .post('/api/token')
            .reply(200, { access_token: 'access-1', refresh_token: 'refresh-1' });

        const response = await request(app)
            .post('/api/token')
            .type('form')
            .send({ code: 'auth-code' });

        assert.equal(response.status, 200);
        assert.equal(JSON.parse(response.text).access_token, 'access-1');
    });

    test('sends the authorization_code grant with Basic auth and the callback URL', async () => {
        let sentBody;
        let sentAuth;
        nock(SPOTIFY)
            .post('/api/token', (body) => { sentBody = body; return true; })
            .reply(200, function () {
                sentAuth = this.req.headers.authorization;
                return { access_token: 'a' };
            });

        await request(app).post('/api/token').type('form').send({ code: 'auth-code' });

        assert.equal(sentBody.grant_type, 'authorization_code');
        assert.equal(sentBody.code, 'auth-code');
        assert.equal(sentBody.redirect_uri, 'song-updater-qa://spotify-login-callback');
        assert.equal(
            sentAuth,
            'Basic ' + Buffer.from('test-client-id:test-client-secret').toString('base64')
        );
    });

    test('responds 402 when Spotify rejects the code', async () => {
        nock(SPOTIFY).post('/api/token').reply(400, { error: 'invalid_grant' });

        const response = await request(app)
            .post('/api/token')
            .type('form')
            .send({ code: 'stale-code' });

        assert.equal(response.status, 402);
    });
});

describe('POST /api/refresh_token', () => {
    test('exchanges a refresh token for a new access token', async () => {
        nock(SPOTIFY)
            .post('/api/refresh_token')
            .optionally()
            .reply(200, {});
        nock(SPOTIFY)
            .post('/api/token')
            .reply(200, { access_token: 'access-2' });

        const response = await request(app)
            .post('/api/refresh_token')
            .type('form')
            .send({ refresh_token: 'refresh-1' });

        assert.equal(response.status, 200);
        assert.equal(JSON.parse(response.text).access_token, 'access-2');
    });

    test('sends the refresh_token grant', async () => {
        let sentBody;
        nock(SPOTIFY)
            .post('/api/token', (body) => { sentBody = body; return true; })
            .reply(200, { access_token: 'a' });

        await request(app)
            .post('/api/refresh_token')
            .type('form')
            .send({ refresh_token: 'refresh-1' });

        assert.equal(sentBody.grant_type, 'refresh_token');
        assert.equal(sentBody.refresh_token, 'refresh-1');
    });

    test('responds 402 when the refresh token is rejected', async () => {
        nock(SPOTIFY).post('/api/token').reply(400, { error: 'invalid_grant' });

        const response = await request(app)
            .post('/api/refresh_token')
            .type('form')
            .send({ refresh_token: 'revoked' });

        assert.equal(response.status, 402);
    });
});
