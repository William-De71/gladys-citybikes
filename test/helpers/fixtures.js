// A fake CityBikes API for the tests, served through the `fetch` option of
// the integration. Its answers are real ones, read on 2026-10-27 around 23:00
// (Paris) and reduced: twelve networks, twelve stations of Vélib' Métropole
// around the Arc de Triomphe (bikes, e-bikes, mechanical bikes, docks), four
// of V'Lille (no e-bike count) and four of nextbike Berlin (no free dock
// count for some). Data of the CityBikes project (https://citybik.es). Tests
// never touch the network.

import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const NOW = Date.parse('2026-10-27T22:00:00Z');
const TZ = 'Europe/Paris';
// A house near the Arc de Triomphe, in Paris.
const HOUSE = { id: 'h1', name: 'Maison', selector: 'maison', latitude: 48.8738, longitude: 2.295 };

const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8'));
const NETWORKS = fixture('networks.json').networks;
const NETWORK_FILES = {
  velib: 'velib.json',
  vlille: 'vlille.json',
  'nextbike-berlin': 'nextbike-berlin.json',
};

const silent = { info() {}, warn() {}, error() {}, debug() {} };
const clone = (value) => JSON.parse(JSON.stringify(value));

/**
 * @description A temporary path for the file kept in /data.
 * @returns {string} The path (its directory exists, the file does not).
 */
const storePath = () => join(mkdtempSync(join(tmpdir(), 'citybikes-')), 'citybikes.json');

/**
 * @description A Gladys client enough for building devices.
 */
const fakeGladys = {
  externalIds(type, key) {
    const device = `ext:citybikes:${type}:${key}`;
    return { device, feature: (feature) => `${device}:${feature}` };
  },
};

/**
 * @description A JSON answer.
 * @param {number} status - The HTTP status.
 * @param {unknown} body - The body.
 * @param {object} [headers] - Extra headers.
 * @returns {Response} The answer.
 */
function answer(status, body, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'x-ratelimit-limit-hour': '300',
      'x-ratelimit-remaining-hour': '297',
      'ratelimit-reset': '1200',
      ...headers,
    },
  });
}

/**
 * @description The fake API.
 * @returns {Function} A `fetch`, with `calls` (the paths asked), `networks`
 * (the raw answers by id, to change between two readings), `station(network,
 * uid)` and `fail` (`null`, `'quota'`, `'down'` or `'error'`).
 */
function fakeCityBikes() {
  const networks = Object.fromEntries(
    Object.entries(NETWORK_FILES).map(([id, file]) => [id, fixture(file).network]),
  );
  const api = async (url) => {
    const { pathname, search } = new URL(url);
    const path = pathname.replace(/^\/v2/, '');
    api.calls.push(`${path}${search}`);
    if (api.fail === 'quota') {
      return answer(429, { message: 'API rate limit exceeded' }, { 'ratelimit-reset': '600' });
    }
    if (api.fail === 'down') {
      throw new TypeError('fetch failed', { cause: new Error('getaddrinfo ENOTFOUND') });
    }
    if (api.fail === 'error') {
      return answer(502, { error: 'Bad gateway' });
    }
    if (path === '/networks') {
      return answer(200, { networks: clone(NETWORKS) });
    }
    const match = /^\/networks\/([^/]+)$/.exec(path);
    if (match && networks[decodeURIComponent(match[1])]) {
      return answer(200, { network: clone(networks[decodeURIComponent(match[1])]) });
    }
    return answer(404, { error: 'Not found' });
  };
  api.calls = [];
  api.networks = networks;
  api.fail = null;
  api.station = (network, uid) =>
    networks[network].stations.find((station) => String(station.extra.uid) === String(uid));
  return api;
}

export { NOW, TZ, HOUSE, NETWORKS, silent, clone, storePath, fakeGladys, fakeCityBikes, fixture };
