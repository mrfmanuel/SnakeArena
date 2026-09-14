/**
 * Tests for src/services/api.real.js — the services-layer client that
 * talks to the real backend. `fetch` is stubbed per test (see
 * `stubFetch` below) so these never make a real network call; they
 * check the request shape sent out and how responses/failures are
 * translated, which is exactly the logic this file adds beyond a bare
 * `fetch` call (404-to-null/[] for profile lookups, ApiError with a
 * readable `.message`/`.status` for everything else).
 *
 * Same load pattern as engine.test.js: `global.window = global` before
 * requiring the script, since it's a plain browser script, not a
 * module. Run with: node --test tests/   (from frontend/, Node 18+)
 */

'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

global.window = global;
require('../src/services/api.real.js');
const { createRealApi, ApiError } = global.SnakeArenaRealApi;

let calls;

function stubFetch(handler) {
  calls = [];
  global.fetch = async (url, opts) => {
    calls.push({ url, opts });
    return handler(url, opts);
  };
}

function fakeResponse({ ok, status, body }) {
  return { ok, status, text: async () => (body === undefined ? '' : JSON.stringify(body)) };
}

test('getOrCreateProfile POSTs the name to /profiles', async () => {
  stubFetch(async () => fakeResponse({ ok: true, status: 201, body: { id: 1, name: 'Ada' } }));
  const api = createRealApi('http://x/api');

  const result = await api.getOrCreateProfile('Ada');

  assert.equal(calls[0].url, 'http://x/api/profiles');
  assert.equal(calls[0].opts.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].opts.body), { name: 'Ada' });
  assert.deepEqual(result, { id: 1, name: 'Ada' });
});

test('getProfileStats GETs /profiles/{name} and resolves to null on 404', async () => {
  stubFetch(async () => fakeResponse({ ok: false, status: 404, body: { message: 'not found' } }));
  const api = createRealApi('http://x/api');

  const result = await api.getProfileStats('Nobody');

  assert.equal(calls[0].url, 'http://x/api/profiles/Nobody');
  assert.equal(result, null);
});

test('getProfileHistory resolves to [] on 404 instead of rejecting', async () => {
  stubFetch(async () => fakeResponse({ ok: false, status: 404, body: { message: 'not found' } }));
  const api = createRealApi('http://x/api');

  const result = await api.getProfileHistory('Nobody');

  assert.deepEqual(result, []);
});

test('profile names with special characters are URL-encoded in the path', async () => {
  stubFetch(async () => fakeResponse({ ok: true, status: 200, body: {} }));
  const api = createRealApi('http://x/api');

  await api.getProfileStats('A/B c');

  assert.equal(calls[0].url, 'http://x/api/profiles/A%2FB%20c');
});

test('a non-404 error response rejects with an ApiError carrying the backend message and status', async () => {
  stubFetch(async () => fakeResponse({ ok: false, status: 400, body: { message: 'Bad request' } }));
  const api = createRealApi('http://x/api');

  await assert.rejects(
    () => api.submitSinglePlayerScore({ profileName: 'A', length: -1 }),
    (err) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.message, 'Bad request');
      assert.equal(err.status, 400);
      return true;
    }
  );
});

test('a network failure rejects with a status-less ApiError mentioning the server', async () => {
  stubFetch(async () => {
    throw new Error('connection refused');
  });
  const api = createRealApi('http://x/api');

  await assert.rejects(
    () => api.getLeaderboard(),
    (err) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.status, null);
      assert.match(err.message, /reach the server/i);
      return true;
    }
  );
});

test('an error response with a non-JSON body still rejects with a readable message', async () => {
  stubFetch(async () => ({ ok: false, status: 500, text: async () => '<html>oops</html>' }));
  const api = createRealApi('http://x/api');

  await assert.rejects(
    () => api.getLeaderboard(),
    (err) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.status, 500);
      assert.match(err.message, /500/);
      return true;
    }
  );
});

test('submitMatchResult sends winnerName: null when omitted (draw)', async () => {
  stubFetch(async () => fakeResponse({ ok: true, status: 201, body: {} }));
  const api = createRealApi('http://x/api');

  await api.submitMatchResult({
    players: [{ name: 'A', length: 1 }, { name: 'B', length: 1 }],
    outcome: 'draw',
  });

  const sent = JSON.parse(calls[0].opts.body);
  assert.equal(calls[0].url, 'http://x/api/matches');
  assert.equal(sent.winnerName, null);
  assert.equal(sent.outcome, 'draw');
});
