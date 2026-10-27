// -----------------------------------------------------------------------------
// HTTP client of the CityBikes API (https://api.citybik.es/v2/), the public
// API of the CityBikes project: the bike sharing systems of the whole world
// (815 networks, 66 in France), read from the operators by PyBikes.
//
// End points used (documentation: https://api.citybik.es/v2/):
//   /v2/networks              every network: id, name, city, country,
//                             coordinates; read weekly (kept in /data);
//   /v2/networks/<id>         one network with all its stations: bikes,
//                             e-bikes, free docks, open or not. One request
//                             per reading, whatever the number of followed
//                             stations (Vélib': 1 516 stations, 230 KB gzip).
//
// No key. The API allows 300 requests per hour and per address
// (`x-ratelimit-remaining-hour`, `ratelimit-reset` in seconds) and answers 429
// beyond. Terms of service: the project using the API must say so and link
// to https://citybik.es (the widgets, the docs and the README do).
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';

const BASE_URL = process.env.CITYBIKES_API_URL || 'https://api.citybik.es/v2';
const TIMEOUT_MS = 30000;
const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const USER_AGENT = `gladys-citybikes/${version} (+https://github.com/William-De71/gladys-citybikes)`;
const NETWORK_ID = /^[a-z0-9][a-z0-9_-]{0,79}$/;

class CityBikesError extends Error {
  /**
   * @param {string} kind - `quota`, `unknown` (no such network), `unreachable`
   * or `invalid`.
   * @param {string} message - The detail.
   * @param {object} [extra] - `{ status, retryAt }`.
   */
  constructor(kind, message, { status = null, retryAt = null } = {}) {
    super(message);
    this.name = 'CityBikesError';
    this.kind = kind;
    this.status = status;
    this.retryAt = retryAt;
  }
}

/**
 * @description Whether a text can be a network id of CityBikes.
 * @param {unknown} value - The text.
 * @returns {boolean} True for "velib", "nextbike-berlin".
 */
const isNetworkId = (value) => typeof value === 'string' && NETWORK_ID.test(value);

/**
 * @description The client.
 * @param {object} [options] - `{ fetch, baseUrl, now }`.
 * @returns {object} `{ networks, network, requests, quota }`.
 */
function createCityBikesClient({
  fetch: fetchFn = globalThis.fetch,
  baseUrl = BASE_URL,
  now = () => Date.now(),
} = {}) {
  const client = {
    // Requests made since the start, for the diagnostic.
    requests: 0,
    // The last quota headers: `{ limit, remaining, resetAt }`.
    quota: null,
    // While the API refused for quota: no request before this time.
    blockedUntil: 0,

    /**
     * @description GET a path of the API.
     * @param {string} path - "/networks".
     * @returns {Promise<object>} The JSON answer.
     */
    async get(path) {
      if (now() < client.blockedUntil) {
        throw new CityBikesError('quota', 'Hourly quota of the CityBikes API reached', {
          status: 429,
          retryAt: client.blockedUntil,
        });
      }
      client.requests += 1;
      let response;
      try {
        response = await fetchFn(`${baseUrl}${path}`, {
          headers: { accept: 'application/json', 'user-agent': USER_AGENT },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch (err) {
        throw new CityBikesError('unreachable', err.cause?.message ?? err.message);
      }
      readQuota(response.headers);
      if (response.status === 429) {
        const reset = Number(response.headers.get('ratelimit-reset'));
        client.blockedUntil = now() + (Number.isFinite(reset) && reset > 0 ? reset : 600) * 1000;
        throw new CityBikesError('quota', 'Hourly quota of the CityBikes API reached', {
          status: 429,
          retryAt: client.blockedUntil,
        });
      }
      if (response.status === 404) {
        throw new CityBikesError('unknown', `${path}: not found`, { status: 404 });
      }
      if (!response.ok) {
        throw new CityBikesError('unreachable', `HTTP ${response.status}`, {
          status: response.status,
        });
      }
      try {
        return await response.json();
      } catch (err) {
        throw new CityBikesError('invalid', `Unreadable answer: ${err.message}`, {
          status: response.status,
        });
      }
    },

    /**
     * @description Every network of CityBikes.
     * @returns {Promise<object[]>} The raw networks.
     */
    async networks() {
      const body = await client.get('/networks?fields=id,name,location,company');
      if (!Array.isArray(body?.networks)) {
        throw new CityBikesError('invalid', 'No network list in the answer');
      }
      return body.networks;
    },

    /**
     * @description One network and its stations.
     * @param {string} id - The network id ("velib").
     * @returns {Promise<object>} The raw network, `stations` included.
     */
    async network(id) {
      if (!isNetworkId(id)) {
        throw new CityBikesError('unknown', `Invalid network id: ${String(id).slice(0, 40)}`);
      }
      const body = await client.get(`/networks/${encodeURIComponent(id)}`);
      if (!body?.network || !Array.isArray(body.network.stations)) {
        throw new CityBikesError('invalid', 'No station list in the answer');
      }
      return body.network;
    },
  };

  /**
   * @description Remember the quota headers of an answer.
   * @param {Headers} headers - The headers.
   */
  function readQuota(headers) {
    const header = (...names) => {
      for (const name of names) {
        const value = headers?.get?.(name);
        if (
          value !== null &&
          value !== undefined &&
          value !== '' &&
          Number.isFinite(Number(value))
        ) {
          return Number(value);
        }
      }
      return null;
    };
    const limit = header('x-ratelimit-limit-hour', 'ratelimit-limit');
    const remaining = header('x-ratelimit-remaining-hour', 'ratelimit-remaining');
    const reset = header('ratelimit-reset');
    if (limit !== null && remaining !== null) {
      client.quota = { limit, remaining, resetAt: reset !== null ? now() + reset * 1000 : null };
    }
  }

  return client;
}

export { BASE_URL, USER_AGENT, CityBikesError, isNetworkId, createCityBikesClient };
