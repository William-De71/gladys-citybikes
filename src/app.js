// -----------------------------------------------------------------------------
// The CityBikes integration: every handler, registered on a Gladys client.
//
// Brings the bike sharing stations of the CityBikes API into Gladys (815
// networks in the world: Vélib', Vélo'v, V3, V'Lille, Bicing, nextbike…):
//   - devices (device.js): one per followed station — typed in the form, and
//     the nearest to the house — with its bikes, e-bikes, mechanical bikes
//     and free docks;
//   - scene triggers (events.js): bikes available again, station empty,
//     e-bikes available again, no e-bike left, free docks again, station
//     full;
//   - scene actions: read a station, find the nearest station with a bike,
//     an e-bike or a free dock;
//   - dashboard widgets (widgets.js): stations, nearby.
//
// The API has no push: the followed network is read on the integration's own
// timer (every 1 to 10 min, 2 by default), one request per reading whatever
// the number of stations, never on a Gladys poll. The list of the networks is
// kept in /data and read again weekly. Transport: cloud only. The house
// coordinates (`location` permission) never leave the container: the nearest
// network and stations are computed here.
//
// index.js only creates the SDK client; the tests drive this module with the
// fake Gladys of the SDK (test/app.test.js).
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { logger as sdkLogger } from '@gladysassistant/integration-sdk';
import { normalizeConfig, readLanguage, INTERNAL_KEYS, AUTO_LANGUAGE } from './config.js';
import { createCityBikesClient, isNetworkId } from './citybikes-api.js';
import {
  parseStation,
  parseNetwork,
  searchNetworks,
  resolveNetwork,
  nearestNetworks,
  nearestStations,
  searchStations,
} from './stations.js';
import { createStore, DEFAULT_PATH } from './store.js';
import {
  stationKeyOf,
  idsOf,
  parseExternalId,
  buildStationDevice,
  buildStationStates,
} from './device.js';
import {
  detectStationEvents,
  countsOf,
  stationOutputs,
  findOutputs,
  wanted,
  distanceText,
  pick,
  STATION_OUTPUTS,
  FIND_OUTPUTS,
  FIND_KINDS,
} from './events.js';
import {
  WIDGETS,
  NEARBY_COUNT,
  readCount,
  readShow,
  messageContent,
  countsText,
  buildStationsWidget,
  buildNearbyWidget,
} from './widgets.js';
import { t, all, LANGUAGES } from './i18n.js';

const ACTIONS = {
  TEST_CONNECTION: 'test_connection',
  SEARCH_NETWORK: 'search_network',
  SEARCH_STATION: 'search_station',
  DIAGNOSTIC: 'diagnostic',
};
const SCENE_ACTIONS = { GET_STATION: 'get_station', FIND_STATION: 'find_station' };
const MINUTE_MS = 60 * 1000;
// The list of the networks barely changes: read weekly.
const NETWORKS_MAX_AGE_MS = 7 * 24 * 60 * MINUTE_MS;
// A widget or a scene action reuses a reading of less than 90 s: the hourly
// quota of the API (300 requests) stays for the timer.
const SNAPSHOT_MAX_AGE_MS = 90 * 1000;
const RETRY_MS = 5 * MINUTE_MS;
const SEARCH_MAX = 12;
const DIAGNOSTIC_CHUNK = 3000;
const { version: VERSION } = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
);

/**
 * @description Create the integration on a Gladys client.
 * @param {object} gladys - The GladysIntegration instance (or the fake one).
 * @param {object} [options] - `{ fetch, baseUrl, storePath, now, timeZone,
 * timers, logger }` (the tests set them).
 * @returns {object} Helpers for the tests.
 */
function createApp(
  gladys,
  {
    fetch: fetchFn,
    baseUrl,
    storePath = DEFAULT_PATH,
    now = () => Date.now(),
    timeZone,
    timers = true,
    logger = sdkLogger,
  } = {},
) {
  let config = normalizeConfig();
  // Language of the last widget request: the fallback of the texts Gladys does
  // not ask for in a language, when the `language` setting is `auto`.
  let language = 'en';
  let createdDevices = new Set();
  // The house the nearest stations are counted from: `{ name, latitude,
  // longitude }`, null when no house is located (or the permission is off).
  let house = null;
  // The followed network (parseNetwork) and its last reading.
  let network = null;
  // The ids of the networks a typed name or city matches when it matches
  // several ("Barcelona": bicing, ambici-amb).
  let candidates = [];
  let snapshot = null;
  let readingNetwork = null;
  // The followed stations: `{ key, deviceId, network, station, from }`, `from`
  // "typed" or "nearby"; and what the network does not know.
  let followed = [];
  let notFound = [];
  let lastError = null;
  let lastStatus = null;
  let lastDiscovery = null;
  let readTimer = null;
  let retryTimer = null;
  let stopped = false;

  const api = createCityBikesClient({
    now,
    ...(fetchFn ? { fetch: fetchFn } : {}),
    ...(baseUrl ? { baseUrl } : {}),
  });
  const store = createStore({ path: storePath, logger });

  /**
   * @description Remember the language of a request, and store it when it changed.
   * @param {string} next - The language.
   */
  function rememberLanguage(next) {
    if (typeof next !== 'string' || !/^[a-z]{2}$/.test(next) || next === language) {
      return;
    }
    language = next;
    gladys
      .setConfig({ [INTERNAL_KEYS.language]: next })
      .catch((err) => logger.warn(`Unable to store the language: ${err.message}`));
  }

  /**
   * @description Language of the texts Gladys does not ask for in a language.
   * @returns {string} The language.
   */
  const textLanguage = () => (config.language === AUTO_LANGUAGE ? language : config.language);

  /**
   * @description The message of an error, for a user.
   * @param {Error} err - The error.
   * @param {string} lang - The language.
   * @returns {string} The message.
   */
  function errorText(err, lang) {
    if (err?.kind === 'quota') {
      return t('errorQuota', lang);
    }
    return t('errorUnreachable', lang, { detail: String(err?.message ?? '').slice(0, 80) });
  }

  /**
   * @description Report the connection status, only when it changed.
   * @param {boolean} connected - Connected or not.
   * @param {object} message - The multi-language message.
   * @returns {Promise<void>}
   */
  async function reportStatus(connected, message) {
    const signature = JSON.stringify([connected, message]);
    if (signature === lastStatus) {
      return;
    }
    lastStatus = signature;
    try {
      await gladys.setConnectionStatus(connected, message);
    } catch (err) {
      lastStatus = null;
      logger.error('Unable to report the connection status', err);
    }
  }

  /**
   * @description Why no network is followed, for a user.
   * @param {string} lang - The language.
   * @returns {string} The message.
   */
  function noNetworkText(lang) {
    if (!config.network) {
      return t(house ? 'statusNoNearNetwork' : 'statusNoNetwork', lang);
    }
    const typed = config.network.slice(0, 60);
    return candidates.length > 1
      ? t('statusAmbiguousNetwork', lang, { network: typed, ids: candidates.join(', ') })
      : t('statusUnknownNetwork', lang, { network: typed });
  }

  /**
   * @description Work out the connection status from the last reading.
   * @returns {Promise<void>}
   */
  async function refreshStatus() {
    if (lastError?.kind === 'quota') {
      await reportStatus(false, all('statusQuota'));
      return;
    }
    if (lastError && lastError.kind !== 'network') {
      await reportStatus(
        false,
        all('errorUnreachable', { detail: String(lastError.message).slice(0, 80) }),
      );
      return;
    }
    if (!network) {
      await reportStatus(false, Object.fromEntries(LANGUAGES.map((l) => [l, noNetworkText(l)])));
      return;
    }
    const unknown = notFound.length
      ? (l) => ` ${t('statusNotFound', l, { names: notFound.join(', ').slice(0, 120) })}`
      : () => '';
    const minutes = Math.round(config.interval / 60);
    await reportStatus(
      true,
      Object.fromEntries(
        LANGUAGES.map((l) => [
          l,
          `${t('statusConnected', l, { network: network.name, count: followed.length, minutes })}${unknown(l)}`,
        ]),
      ),
    );
  }

  /**
   * @description Refresh the list of the devices the user created.
   * @returns {Promise<void>}
   */
  async function refreshCreatedDevices() {
    try {
      const devices = await gladys.getDevices();
      createdDevices = new Set(devices.map((device) => device.external_id));
    } catch (err) {
      logger.warn(`Unable to read the devices: ${err.message}`);
    }
  }

  /**
   * @description Ask the open widgets to pull their content again.
   * @param {string[]} keys - The widget keys.
   */
  function refreshWidgets(keys) {
    for (const key of keys) {
      Promise.resolve(gladys.requestWidgetRefresh(key)).catch(() => {});
    }
  }

  /**
   * @description Read the house the nearest stations are counted from.
   * @returns {Promise<void>}
   */
  async function readHouse() {
    try {
      const houses = (await gladys.getHouses()) ?? [];
      const located = houses.filter(
        (h) => Number.isFinite(h.latitude) && Number.isFinite(h.longitude),
      );
      const chosen = located.find((h) => h.selector === config.house) ?? located[0] ?? null;
      house = chosen
        ? { name: chosen.name, latitude: chosen.latitude, longitude: chosen.longitude }
        : null;
    } catch (err) {
      // 403 when the location permission is refused: the typed network and
      // stations still work.
      logger.warn(`Unable to read the houses: ${err.message}`);
      house = null;
    }
  }

  // --- Networks ----------------------------------------------------------------------

  /**
   * @description The networks of CityBikes, from /data when read this week.
   * @param {boolean} [force] - Read them again.
   * @returns {Promise<object[]>} The networks (parseNetwork).
   */
  async function networks(force = false) {
    const kept = store.data.networks;
    if (
      !force &&
      Array.isArray(kept.list) &&
      kept.list.length > 0 &&
      now() - kept.at < NETWORKS_MAX_AGE_MS
    ) {
      return kept.list;
    }
    try {
      const list = (await api.networks()).map(parseNetwork).filter(Boolean);
      store.data.networks = { list, at: now() };
      await store.save();
      return list;
    } catch (err) {
      if (Array.isArray(kept.list) && kept.list.length > 0) {
        logger.warn(
          `Unable to read the networks again, keeping ${kept.list.length}: ${err.message}`,
        );
        return kept.list;
      }
      throw err;
    }
  }

  /**
   * @description The network of the configuration: the typed one, else the
   * nearest to the house.
   * @returns {Promise<object|null>} The network, null when none fits.
   */
  async function resolveConfiguredNetwork() {
    const list = await networks();
    candidates = [];
    if (config.network) {
      const found = resolveNetwork(list, config.network);
      if (found) {
        return found;
      }
      // An id just added to CityBikes: the weekly list may not know it yet.
      if (isNetworkId(config.network.toLowerCase())) {
        try {
          const raw = await api.network(config.network.toLowerCase());
          return parseNetwork(raw);
        } catch (err) {
          if (err.kind !== 'unknown') {
            throw err;
          }
        }
      }
      candidates = searchNetworks(list, config.network)
        .slice(0, 6)
        .map((candidate) => candidate.id);
      return null;
    }
    return house ? (nearestNetworks(list, house, 1)[0] ?? null) : null;
  }

  // --- Stations ----------------------------------------------------------------------

  /**
   * @description Read a network and its stations.
   * @param {string} id - The network id.
   * @returns {Promise<object>} `{ network, stations, byKey, readAt }`.
   */
  async function readStations(id) {
    const raw = await api.network(id);
    const stations = raw.stations.map(parseStation).filter(Boolean);
    return {
      network: parseNetwork(raw) ?? network,
      stations,
      byKey: new Map(stations.map((station) => [station.key, station])),
      readAt: now(),
    };
  }

  /**
   * @description The followed stations in the last reading.
   * @param {object} current - The reading (readStations).
   * @returns {{ list: object[], unknown: string[] }} The followed stations and
   * the typed entries the network does not know (or knows several times).
   */
  function resolveFollowed(current) {
    const list = [];
    const unknown = [];
    const add = (station, from) => {
      const key = stationKeyOf(network.id, station.key);
      if (!list.some((entry) => entry.key === key)) {
        list.push({ key, deviceId: idsOf(gladys, key).device, network, station, from });
      }
    };
    for (const typed of config.stations) {
      const found = searchStations(current.stations, typed);
      if (found.length === 1) {
        add(found[0], 'typed');
      } else {
        unknown.push(found.length > 1 ? `${typed} (×${found.length})` : typed);
      }
    }
    if (house && config.nearby > 0) {
      for (const station of nearestStations(current.stations, house, config.nearby)) {
        add(station, 'nearby');
      }
    }
    return { list, unknown };
  }

  /**
   * @description Offer a device per followed station on the Discovery
   * screen, when they changed.
   * @param {boolean} [force] - Publish even when unchanged.
   * @returns {Promise<number>} How many devices were offered.
   */
  async function publishDiscoveredDevices(force = false) {
    const devices = followed.map((entry) => buildStationDevice(gladys, entry, textLanguage()));
    const signature = JSON.stringify(devices);
    if (!force && signature === lastDiscovery) {
      return devices.length;
    }
    try {
      await gladys.publishDiscoveredDevices(devices);
      lastDiscovery = signature;
    } catch (err) {
      logger.error('Unable to publish the discovered devices', err);
    }
    return devices.length;
  }

  /**
   * @description Publish the states of the created stations that changed.
   * @returns {Promise<void>}
   */
  async function publishStates() {
    const states = followed
      .filter((entry) => createdDevices.has(entry.deviceId))
      .flatMap((entry) => buildStationStates(gladys, entry));
    if (states.length === 0) {
      return;
    }
    try {
      await gladys.publishChangedStates(states, { heartbeat: 30 * MINUTE_MS });
    } catch (err) {
      logger.warn(`Unable to publish the states: ${err.message}`);
    }
  }

  /**
   * @description Fire the scene events of the stations that changed since the
   * last reading, and remember the new counts.
   * @returns {Promise<void>}
   */
  async function fireEvents() {
    let changed = false;
    for (const entry of followed) {
      const before = store.data.seen[entry.key] ?? null;
      const after = countsOf(entry.station);
      if (JSON.stringify(before) !== JSON.stringify(after)) {
        store.data.seen[entry.key] = after;
        changed = true;
      }
      // A device the user did not create is followed for its baseline only.
      if (!createdDevices.has(entry.deviceId)) {
        continue;
      }
      for (const { key, data } of detectStationEvents(before, entry)) {
        logger.info(`${entry.station.name}: ${key}`);
        try {
          await gladys.publishSceneEvent(key, data);
        } catch (err) {
          logger.warn(`Unable to fire ${key}: ${err.message}`);
        }
      }
    }
    // Forget the stations no longer followed.
    const keys = new Set(followed.map((entry) => entry.key));
    for (const key of Object.keys(store.data.seen)) {
      if (!keys.has(key)) {
        delete store.data.seen[key];
        changed = true;
      }
    }
    if (changed) {
      await store.save();
    }
  }

  /**
   * @description Read the followed network, then publish devices, states and
   * events. Concurrent calls share one reading.
   * @returns {Promise<object|null>} The reading, null on failure.
   */
  function readNetwork() {
    if (!readingNetwork) {
      readingNetwork = (async () => {
        try {
          if (!network) {
            network = await resolveConfiguredNetwork();
          }
          if (!network) {
            followed = [];
            notFound = [];
            lastError = null;
            return null;
          }
          const current = await readStations(network.id);
          network = current.network;
          snapshot = current;
          const resolved = resolveFollowed(current);
          followed = resolved.list;
          notFound = resolved.unknown;
          lastError = null;
          await publishDiscoveredDevices();
          await publishStates();
          await fireEvents();
          return current;
        } catch (err) {
          logger.warn(`Unable to read CityBikes (${err.kind ?? 'error'}): ${err.message}`);
          lastError = err;
          if (!network && timers && !stopped) {
            clearTimeout(retryTimer);
            retryTimer = setTimeout(() => {
              readNetwork().catch(() => {});
            }, RETRY_MS);
            retryTimer.unref?.();
          }
          return null;
        } finally {
          readingNetwork = null;
          await refreshStatus();
        }
      })();
    }
    return readingNetwork;
  }

  /**
   * @description The last reading, read again when older than a bound.
   * @param {number} maxAge - The bound, in milliseconds.
   * @returns {Promise<object>} The reading.
   * @throws {Error} When no network is followed or the API fails.
   */
  async function freshSnapshot(maxAge) {
    if (snapshot && now() - snapshot.readAt < maxAge) {
      return snapshot;
    }
    const current = await readNetwork();
    if (current) {
      return current;
    }
    if (lastError) {
      throw lastError;
    }
    throw Object.assign(new Error('No network is followed'), { kind: 'network' });
  }

  /**
   * @description Apply the configuration: resolve the network, read it, set
   * the timer.
   * @returns {Promise<void>}
   */
  async function applyConfig() {
    clearInterval(readTimer);
    clearTimeout(retryTimer);
    network = null;
    snapshot = null;
    lastDiscovery = null;
    await readNetwork();
    if (timers && !stopped) {
      readTimer = setInterval(() => {
        readNetwork().catch(() => {});
      }, config.interval * 1000);
      readTimer.unref?.();
    }
  }

  /**
   * @description The followed station a device external id stands for.
   * @param {unknown} externalId - A device external id, empty for the first.
   * @returns {object|null} The followed station.
   */
  function target(externalId) {
    if (!externalId) {
      return followed[0] ?? null;
    }
    const key = parseExternalId(externalId);
    return followed.find((entry) => entry.key === key) ?? null;
  }

  // --- Widgets -----------------------------------------------------------------------
  gladys.onWidgetGet(WIDGETS.STATIONS, async ({ settings = {}, language: lang }) => {
    rememberLanguage(lang);
    try {
      const current = await freshSnapshot(SNAPSHOT_MAX_AGE_MS);
      const chosen = Array.isArray(settings.stations) ? settings.stations : [];
      const entries =
        chosen.length > 0
          ? chosen.map((id) => target(id)).filter(Boolean)
          : followed.filter((entry) => createdDevices.has(entry.deviceId));
      return buildStationsWidget({
        stations: (entries.length > 0 ? entries : followed).map((entry) => ({
          name: entry.station.name,
          station: current.byKey.get(entry.station.key) ?? null,
        })),
        readAt: current.readAt,
        language: lang,
        timeZone,
      });
    } catch (err) {
      if (err.kind === 'network') {
        return messageContent(t('widgetNoNetwork', lang));
      }
      logger.warn(`Widget: unable to read the stations: ${err.message}`);
      return messageContent(errorText(err, lang), 60);
    }
  });

  gladys.onWidgetGet(WIDGETS.NEARBY, async ({ settings = {}, language: lang }) => {
    rememberLanguage(lang);
    if (!house) {
      return messageContent(t('widgetNoHouse', lang));
    }
    try {
      const current = await freshSnapshot(SNAPSHOT_MAX_AGE_MS);
      const show = readShow(settings.show);
      const keep = show === 'all' ? () => true : wanted(show);
      return buildNearbyWidget({
        stations: nearestStations(
          current.stations,
          house,
          readCount(settings.count, NEARBY_COUNT),
          keep,
        ),
        network: current.network,
        readAt: current.readAt,
        show,
        language: lang,
        timeZone,
      });
    } catch (err) {
      if (err.kind === 'network') {
        return messageContent(t('widgetNoNetwork', lang));
      }
      logger.warn(`Widget: unable to read the nearby stations: ${err.message}`);
      return messageContent(errorText(err, lang), 60);
    }
  });

  // --- Scene actions -----------------------------------------------------------------
  gladys.onSceneAction(SCENE_ACTIONS.GET_STATION, async (fields = {}) => {
    const entry = target(fields.station);
    if (!entry) {
      throw new Error('No CityBikes station is followed');
    }
    const current = await freshSnapshot(SNAPSHOT_MAX_AGE_MS);
    return pick(
      stationOutputs(current.byKey.get(entry.station.key) ?? null, {
        name: entry.station.name,
        language: textLanguage(),
      }),
      STATION_OUTPUTS,
    );
  });

  gladys.onSceneAction(SCENE_ACTIONS.FIND_STATION, async (fields = {}) => {
    const kind = Object.values(FIND_KINDS).includes(fields.kind) ? fields.kind : FIND_KINDS.BIKE;
    const current = await freshSnapshot(SNAPSHOT_MAX_AGE_MS);
    // From a followed station when chosen, else from the house.
    const from = fields.near ? target(fields.near) : null;
    const point = from ? (current.byKey.get(from.station.key) ?? from.station) : house;
    if (!point || point.latitude === null || point.latitude === undefined) {
      throw new Error('No located house and no station chosen');
    }
    const [nearest] = nearestStations(current.stations, point, 1, wanted(kind));
    return pick(findOutputs(nearest ?? null, { kind, language: textLanguage() }), FIND_OUTPUTS);
  });

  // --- Configuration screen actions --------------------------------------------------
  gladys.onAction(ACTIONS.TEST_CONNECTION, async () => {
    let list;
    try {
      list = await networks(true);
    } catch (err) {
      lastError = err;
      await refreshStatus();
      return all('testError', (l) => ({ error: errorText(err, l) }));
    }
    await readHouse();
    network = null;
    snapshot = null;
    const current = await readNetwork();
    const head = (l) => t('testNetworks', l, { count: list.length });
    if (!network) {
      const reason = lastError ? (l) => errorText(lastError, l) : noNetworkText;
      return Object.fromEntries(LANGUAGES.map((l) => [l, `${head(l)} ${reason(l)}`]));
    }
    if (!current) {
      return Object.fromEntries(LANGUAGES.map((l) => [l, `${head(l)} ${errorText(lastError, l)}`]));
    }
    return Object.fromEntries(
      LANGUAGES.map((l) => {
        const lines = followed.map((entry) =>
          t('listLine', l, { name: entry.station.name, counts: countsText(entry.station, l) }),
        );
        const missing = notFound.length
          ? `\n${t('statusNotFound', l, { names: notFound.join(', ').slice(0, 200) })}`
          : '';
        return [
          l,
          `${head(l)} ${t('testOk', l, {
            network: network.name,
            stations: current.stations.length,
            count: followed.length,
            house: house ? house.name : t('noHouse', l),
          })}${lines.length ? `\n${lines.slice(0, 25).join('\n')}` : ''}${missing}`.slice(0, 1500),
        ];
      }),
    );
  });

  gladys.onAction(ACTIONS.SEARCH_NETWORK, async (fields = {}) => {
    const query = typeof fields.query === 'string' ? fields.query.trim() : '';
    let list;
    try {
      list = await networks();
    } catch (err) {
      return all('testError', (l) => ({ error: errorText(err, l) }));
    }
    const found = query
      ? searchNetworks(list, query)
      : house
        ? nearestNetworks(list, house, SEARCH_MAX)
        : [];
    if (found.length === 0) {
      return all(query ? 'searchNone' : 'searchNetworkEmpty', { query: query.slice(0, 60) });
    }
    return all('searchNetworkFound', (l) => ({
      count: found.length,
      list: found
        .slice(0, SEARCH_MAX)
        .map((n) => {
          const where = [n.city, n.country].filter(Boolean).join(', ');
          const far = n.distance !== undefined ? ` · ${distanceText(n.distance, l)}` : '';
          return `• ${n.id} — ${n.name}${where ? ` (${where})` : ''}${far}`;
        })
        .join('\n'),
    }));
  });

  gladys.onAction(ACTIONS.SEARCH_STATION, async (fields = {}) => {
    const query = typeof fields.query === 'string' ? fields.query.trim() : '';
    if (query.length < 2) {
      return all('searchTooShort');
    }
    let current;
    try {
      current = await freshSnapshot(SNAPSHOT_MAX_AGE_MS);
    } catch (err) {
      if (err.kind === 'network') {
        return all('widgetNoNetwork');
      }
      return all('testError', (l) => ({ error: errorText(err, l) }));
    }
    const found = searchStations(current.stations, query);
    if (found.length === 0) {
      return all('searchNone', { query: query.slice(0, 60) });
    }
    return all('searchStationFound', (l) => ({
      network: current.network.name,
      count: found.length,
      list: found
        .slice(0, SEARCH_MAX)
        .map((s) =>
          t('listLine', l, { name: `${s.uid || s.id} — ${s.name}`, counts: countsText(s, l) }),
        )
        .join('\n'),
    }));
  });

  gladys.onAction(ACTIONS.DIAGNOSTIC, async () => {
    const report = {
      version: VERSION,
      config: { ...config },
      house: house ? { name: house.name } : null,
      network,
      readAt: snapshot ? new Date(snapshot.readAt).toISOString() : null,
      stations: snapshot?.stations.length ?? null,
      followed: followed.map((entry) => ({
        key: entry.key,
        from: entry.from,
        created: createdDevices.has(entry.deviceId),
        station: entry.station,
        seen: store.data.seen[entry.key] ?? null,
      })),
      notFound,
      networks: store.data.networks.list?.length ?? null,
      networksAt: store.data.networks.at ? new Date(store.data.networks.at).toISOString() : null,
      error: lastError ? { kind: lastError.kind, message: lastError.message } : null,
      requests: api.requests,
      quota: api.quota,
    };
    const json = JSON.stringify(report);
    const count = Math.max(1, Math.ceil(json.length / DIAGNOSTIC_CHUNK));
    for (let chunk = 0; chunk < count; chunk += 1) {
      logger.info(
        `CityBikes diagnostic ${chunk + 1}/${count}: ${json.slice(chunk * DIAGNOSTIC_CHUNK, (chunk + 1) * DIAGNOSTIC_CHUNK)}`,
      );
    }
    return all('diagnosticDone', { count });
  });

  // --- Devices -----------------------------------------------------------------------
  gladys.onScanRequest(async () => {
    await readNetwork();
    const count = await publishDiscoveredDevices(true);
    logger.info(`Scan: ${count} device(s) offered`);
  });

  gladys.onDeviceCreated(async () => {
    await refreshCreatedDevices();
    // States sent before the device existed were dropped by Gladys, and the SDK
    // forgot what it sent for this device: send everything known again.
    await publishStates();
    refreshWidgets(Object.values(WIDGETS));
  });

  gladys.onDeviceDeleted(refreshCreatedDevices);

  // --- Configuration -----------------------------------------------------------------

  /**
   * @description Reload the whole config (internal keys included).
   * @param {object} [fallback] - Raw values to use when the read fails.
   * @returns {Promise<void>}
   */
  async function loadConfig(fallback) {
    try {
      const raw = await gladys.getConfig();
      config = normalizeConfig(raw);
      language = readLanguage(raw, language);
    } catch (err) {
      if (fallback) {
        config = normalizeConfig(fallback);
      }
      logger.error('Unable to read the configuration', err);
    }
  }

  gladys.onConfigUpdated(async (raw) => {
    await loadConfig(raw);
    await readHouse();
    logger.info('Configuration updated');
    await applyConfig();
  });

  // --- Connection lifecycle ----------------------------------------------------------
  // Each (re)connection resynchronizes; the promise lets the tests wait for it.
  let startup = Promise.resolve();
  gladys.on('connected', () => {
    startup = (async () => {
      await loadConfig();
      await store.load();
      await refreshCreatedDevices();
      await readHouse();
      lastStatus = null;
      await applyConfig();
    })().catch((err) => logger.error('Startup', err));
  });

  // --- Graceful shutdown -------------------------------------------------------------
  gladys.handleShutdown(async (signal) => {
    logger.info(`Received ${signal} -> graceful shutdown`);
    stopped = true;
    clearInterval(readTimer);
    clearTimeout(retryTimer);
    await store.save();
  });

  return {
    store,
    api,
    readNetwork,
    applyConfig,
    getConfig: () => config,
    getFollowed: () => followed,
    getNetwork: () => network,
    getHouse: () => house,
    getSnapshot: () => snapshot,
    whenReady: () => startup,
  };
}

export { createApp, ACTIONS, SCENE_ACTIONS, SNAPSHOT_MAX_AGE_MS, NETWORKS_MAX_AGE_MS };
