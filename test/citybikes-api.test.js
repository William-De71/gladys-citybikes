// The HTTP client of the CityBikes API: answers, errors, hourly quota.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createCityBikesClient, isNetworkId, USER_AGENT } from '../src/citybikes-api.js';
import { fakeCityBikes, NOW } from './helpers/fixtures.js';

test('reads the networks and one network, with the quota headers', async () => {
  const fetch = fakeCityBikes();
  const client = createCityBikesClient({ fetch, now: () => NOW });
  const networks = await client.networks();
  assert.equal(networks.length, 12);
  assert.equal(fetch.calls[0], '/networks?fields=id,name,location,company');
  const velib = await client.network('velib');
  assert.equal(velib.stations.length, 12);
  assert.deepEqual(client.quota, { limit: 300, remaining: 297, resetAt: NOW + 1200 * 1000 });
  assert.equal(client.requests, 2);
});

test('sends its User-Agent and asks for JSON', async () => {
  let seen;
  const client = createCityBikesClient({
    fetch: async (url, options) => {
      seen = options.headers;
      return new Response('{"networks":[]}', { status: 200 });
    },
  });
  await client.networks();
  assert.equal(seen['user-agent'], USER_AGENT);
  assert.match(USER_AGENT, /^gladys-citybikes\/\d+\.\d+\.\d+ \(\+https:\/\/github\.com\//);
  assert.equal(seen.accept, 'application/json');
});

test('an unknown network is a 404, an invalid id never reaches the API', async () => {
  const fetch = fakeCityBikes();
  const client = createCityBikesClient({ fetch });
  await assert.rejects(client.network('nowhere'), { kind: 'unknown' });
  await assert.rejects(client.network('../networks'), { kind: 'unknown' });
  assert.deepEqual(fetch.calls, ['/networks/nowhere']);
  assert.equal(isNetworkId('nextbike-berlin'), true);
  assert.equal(isNetworkId('Vélib'), false);
});

test('429: no request until the reset of the quota', async () => {
  const fetch = fakeCityBikes();
  let now = NOW;
  const client = createCityBikesClient({ fetch, now: () => now });
  fetch.fail = 'quota';
  await assert.rejects(client.network('velib'), { kind: 'quota', retryAt: NOW + 600 * 1000 });
  fetch.fail = null;
  await assert.rejects(client.network('velib'), { kind: 'quota' });
  assert.equal(fetch.calls.length, 1, 'blocked without a request');
  now += 601 * 1000;
  assert.equal((await client.network('velib')).id, 'velib');
});

test('down, HTTP errors and unreadable answers', async () => {
  const fetch = fakeCityBikes();
  const client = createCityBikesClient({ fetch });
  fetch.fail = 'down';
  await assert.rejects(client.networks(), { kind: 'unreachable', message: /ENOTFOUND/ });
  fetch.fail = 'error';
  await assert.rejects(client.networks(), { kind: 'unreachable', status: 502 });
  const broken = createCityBikesClient({
    fetch: async () => new Response('<html>', { status: 200 }),
  });
  await assert.rejects(broken.networks(), { kind: 'invalid' });
  const empty = createCityBikesClient({ fetch: async () => new Response('{}', { status: 200 }) });
  await assert.rejects(empty.network('velib'), { kind: 'invalid' });
});
