// The whole integration against the fake Gladys of the SDK
// (`@gladysassistant/integration-sdk/testing`), which checks the discovered
// devices, the states and the scene events like the host API does, and a
// fake CityBikes API serving real (reduced) answers.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';

import { createApp, ACTIONS, SCENE_ACTIONS, NETWORKS_MAX_AGE_MS } from '../src/app.js';
import { TRIGGERS } from '../src/events.js';
import { fakeCityBikes, storePath, silent, NOW, TZ, HOUSE } from './helpers/fixtures.js';

const CONFIG = {
  stations: '22002, Messine - Place Du Pérou, Nulle part',
  nearby: '2',
  language: 'fr',
};
const PREFIX = 'ext:test-integration:station';
const ARGENSON = `${PREFIX}:velib_22002`;
const MESSINE = `${PREFIX}:velib_8026`;

/**
 * @description The integration, connected to a fake Gladys and a fake API.
 * @param {object} [options] - `{ config, houses, path, api }`.
 * @returns {Promise<object>} `{ gladys, app, api, clock, path }`.
 */
async function startApp({
  config = CONFIG,
  houses = [HOUSE],
  path = storePath(),
  api = fakeCityBikes(),
} = {}) {
  const clock = { now: NOW };
  const gladys = createFakeGladys({ config, houses });
  const app = createApp(gladys, {
    fetch: api,
    storePath: path,
    now: () => clock.now,
    timeZone: TZ,
    timers: false,
    logger: silent,
  });
  await gladys.connect();
  await app.whenReady();
  return { gladys, app, api, clock, path };
}

const createAll = async (gladys) => {
  for (const device of gladys.fake.discoveredDevices) {
    await gladys.fake.deviceCreated(device);
  }
};
const message = (ack, language = 'en') => ack.data.message[language];

test('startup: the network nearest to the house, the typed and the nearest stations', async () => {
  const { gladys, app, api } = await startApp();
  assert.equal(app.getNetwork().id, 'velib');
  assert.deepEqual(api.calls, ['/networks?fields=id,name,location,company', '/networks/velib']);
  const ids = gladys.fake.discoveredDevices.map((d) => d.external_id);
  assert.equal(ids[0], ARGENSON);
  assert.equal(ids[1], MESSINE);
  assert.equal(ids.length, 4, 'two typed, two nearest');
  assert.deepEqual(
    app.getFollowed().map((entry) => entry.from),
    ['typed', 'typed', 'nearby', 'nearby'],
  );
  const status = gladys.fake.connectionStatus;
  assert.equal(status.connected, true);
  assert.equal(
    status.message.fr,
    "Vélib' Métropole : 4 station(s) suivie(s), lue(s) toutes les 2 min. Introuvable : Nulle part.",
  );
  assert.equal(gladys.fake.states.length, 0, 'no state before the devices exist');
});

test('a created device gets its states; only the changed ones afterwards', async () => {
  const { gladys, app, api } = await startApp();
  await createAll(gladys);
  assert.equal(gladys.fake.lastState(`${ARGENSON}:bikes`), 13);
  assert.equal(gladys.fake.lastState(`${ARGENSON}:ebikes`), 6);
  assert.equal(gladys.fake.lastState(`${ARGENSON}:docks`), 12);
  const before = gladys.fake.states.length;
  api.station('velib', '22002').free_bikes = 12;
  api.station('velib', '22002').extra.ebikes = 5;
  await app.readNetwork();
  const sent = gladys.fake.states.slice(before).map((s) => s.device_feature_external_id);
  assert.deepEqual(sent.sort(), [`${ARGENSON}:bikes`, `${ARGENSON}:ebikes`]);
});

test('scene events on transitions of created stations, never twice after a restart', async () => {
  const path = storePath();
  const api = fakeCityBikes();
  const first = await startApp({ path, api });
  await createAll(first.gladys);
  // Messine had no bike: one arrives.
  api.station('velib', '8026').free_bikes = 1;
  api.station('velib', '8026').extra.ebikes = 1;
  // Argenson: every dock taken.
  api.station('velib', '22002').empty_slots = 0;
  await first.app.readNetwork();
  const keys = first.gladys.fake.sceneEvents.map(
    (event) => `${event.key}:${event.data.station_name}`,
  );
  assert.deepEqual(
    keys.sort(),
    [
      `${TRIGGERS.BIKES_AVAILABLE}:Messine - Place Du Pérou`,
      `${TRIGGERS.EBIKES_AVAILABLE}:Messine - Place Du Pérou`,
      `${TRIGGERS.STATION_FULL}:Argenson - Château`,
    ].sort(),
  );
  const event = first.gladys.fake.sceneEvents.find((e) => e.key === TRIGGERS.STATION_FULL);
  assert.equal(event.data.station, ARGENSON);
  assert.equal(event.data.docks, 0);
  await first.gladys.fake.shutdown();
  const stored = JSON.parse(readFileSync(path, 'utf8'));
  assert.equal(stored.seen.velib_22002.docks, 0);

  const second = await startApp({ path, api });
  await createAll(second.gladys);
  await second.app.readNetwork();
  assert.equal(second.gladys.fake.sceneEvents.length, 0, 'the same state fires nothing again');
  assert.deepEqual(
    second.api.calls.filter((call) => call.startsWith('/networks?')).length,
    1,
    'the networks of /data are reused',
  );
});

test('a station not created is followed for its baseline only', async () => {
  const { gladys, app, api } = await startApp();
  api.station('velib', '8026').free_bikes = 4;
  await app.readNetwork();
  assert.equal(gladys.fake.sceneEvents.length, 0);
  await createAll(gladys);
  api.station('velib', '8026').free_bikes = 0;
  await app.readNetwork();
  assert.deepEqual(
    gladys.fake.sceneEvents.map((e) => e.key),
    [TRIGGERS.STATION_EMPTY],
  );
});

test('a network typed by id or city; nearby without a house', async () => {
  const { app, gladys } = await startApp({
    config: { network: 'Lille', stations: '', nearby: '3' },
    houses: [],
  });
  assert.equal(app.getNetwork().id, 'vlille');
  assert.equal(app.getHouse(), null);
  assert.equal(gladys.fake.discoveredDevices.length, 0);
  const typed = await startApp({ config: { network: 'nextbike-berlin', nearby: '0' } });
  assert.equal(typed.app.getNetwork().id, 'nextbike-berlin');
});

test('an unknown network, no network and no house: a status that says what to do', async () => {
  const unknown = await startApp({ config: { network: 'Atlantis' } });
  assert.equal(unknown.gladys.fake.connectionStatus.connected, false);
  assert.match(unknown.gladys.fake.connectionStatus.message.en, /no network “Atlantis”/);
  const ambiguous = await startApp({ config: { network: 'velo' } });
  assert.match(
    ambiguous.gladys.fake.connectionStatus.message.fr,
    /^Plusieurs réseaux correspondent à « velo » : le-velo-star, velov, velo2, /,
  );
  const nothing = await startApp({ config: {}, houses: [] });
  assert.match(nothing.gladys.fake.connectionStatus.message.fr, /Choisissez un réseau/);
  const widget = await nothing.gladys.fake.widgetGet('stations', { language: 'de' });
  assert.match(widget.data.content.components[0].text, /Kein Leihradnetz/);
});

test('an id unknown to the weekly list is read directly', async () => {
  const api = fakeCityBikes();
  api.networks['new-network'] = { ...api.networks.vlille, id: 'new-network', name: 'New' };
  const { app } = await startApp({ api, config: { network: 'new-network' } });
  assert.equal(app.getNetwork().id, 'new-network');
});

test('quota: the status says so, the stations keep their last states', async () => {
  const { gladys, app, api } = await startApp();
  await createAll(gladys);
  api.fail = 'quota';
  await app.readNetwork();
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.match(gladys.fake.connectionStatus.message.en, /Hourly quota/);
  assert.equal(gladys.fake.lastState(`${ARGENSON}:bikes`), 13);
  api.fail = 'down';
  // Still blocked until the reset: no request.
  const calls = api.calls.length;
  await app.readNetwork();
  assert.equal(api.calls.length, calls);
});

test('the API down at start: retried, then connected', async () => {
  const api = fakeCityBikes();
  api.fail = 'down';
  const { gladys, app } = await startApp({ api });
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.match(gladys.fake.connectionStatus.message.en, /cannot be reached/);
  api.fail = null;
  await app.readNetwork();
  assert.equal(gladys.fake.connectionStatus.connected, true);
});

test('widgets: the created stations, the nearest ones, valid in every language', async () => {
  const { gladys, api } = await startApp();
  await createAll(gladys);
  const calls = api.calls.length;
  for (const language of ['en', 'fr', 'de', 'es']) {
    const stations = (await gladys.fake.widgetGet('stations', { language })).data.content;
    assert.deepEqual(validateWidgetContent(stations), []);
    assert.equal(stations.components.find((c) => c.type === 'card-list').items.length, 4);
    const one = (
      await gladys.fake.widgetGet('stations', { language, settings: { stations: [ARGENSON] } })
    ).data.content;
    assert.equal(one.components[0].text, 'Argenson - Château');
    const nearby = (
      await gladys.fake.widgetGet('nearby', { language, settings: { count: 3, show: 'bike' } })
    ).data.content;
    assert.deepEqual(validateWidgetContent(nearby), []);
    const items = nearby.components.find((c) => c.type === 'card-list').items;
    assert.equal(items.length, 3);
    assert.ok(items.every((item) => item.badge.text !== '0'));
  }
  assert.equal(api.calls.length, calls, 'a reading of less than 90 s is reused');
  assert.ok(gladys.fake.widgetRefreshes.length > 0, 'refreshed when a device is created');
});

test('the nearby widget without a located house', async () => {
  const { gladys } = await startApp({
    config: { network: 'velib' },
    houses: [{ ...HOUSE, latitude: null, longitude: null }],
  });
  const content = (await gladys.fake.widgetGet('nearby', { language: 'fr' })).data.content;
  assert.match(content.components[0].text, /La maison n’a pas de position/);
});

test('scene actions: read a station, find the nearest e-bike or dock', async () => {
  const { gladys } = await startApp();
  await createAll(gladys);
  const read = await gladys.fake.sceneAction(SCENE_ACTIONS.GET_STATION, { station: ARGENSON });
  assert.deepEqual(read.data.outputs, {
    station_name: 'Argenson - Château',
    found: true,
    open: true,
    bikes: 13,
    ebikes: 6,
    mechanical: 7,
    docks: 12,
    summary: 'Argenson - Château : 13 vélos (6 électriques), 12 places.',
  });
  const first = await gladys.fake.sceneAction(SCENE_ACTIONS.GET_STATION, {});
  assert.equal(first.data.outputs.station_name, 'Argenson - Château');
  const ebike = await gladys.fake.sceneAction(SCENE_ACTIONS.FIND_STATION, { kind: 'ebike' });
  assert.equal(ebike.data.outputs.found, true);
  assert.ok(ebike.data.outputs.ebikes > 0 && ebike.data.outputs.distance > 0);
  const fromStation = await gladys.fake.sceneAction(SCENE_ACTIONS.FIND_STATION, {
    kind: 'dock',
    near: ARGENSON,
  });
  assert.equal(fromStation.data.outputs.station_name, 'Argenson - Château', 'itself, 0 m');
  assert.equal(fromStation.data.outputs.distance, 0);
});

test('find a station with no e-bike left anywhere', async () => {
  const api = fakeCityBikes();
  for (const s of api.networks.velib.stations) {
    s.extra.ebikes = 0;
  }
  const { gladys } = await startApp({ api });
  const none = await gladys.fake.sceneAction(SCENE_ACTIONS.FIND_STATION, { kind: 'ebike' });
  assert.deepEqual([none.data.outputs.found, none.data.outputs.distance], [false, -1]);
  assert.equal(none.data.outputs.summary, 'Aucune station avec un vélo électrique à proximité.');
});

test('configuration actions: test, find a network, find a station, diagnostic', async () => {
  const { gladys, api } = await startApp();
  const tested = await gladys.fake.action(ACTIONS.TEST_CONNECTION);
  assert.match(
    message(tested, 'fr'),
    /^CityBikes répond \(12 réseaux\)\. Réseau Vélib' Métropole : 12 stations, 4 suivie\(s\) \(maison : Maison\)\./,
  );
  assert.match(message(tested, 'fr'), /• Argenson - Château : 13 vélos/);
  assert.match(message(tested, 'en'), /Not found: Nulle part\./);
  assert.equal(api.calls.filter((call) => call.startsWith('/networks?')).length, 2, 'read again');

  const lyon = await gladys.fake.action(ACTIONS.SEARCH_NETWORK, { query: 'Lyon' });
  assert.match(message(lyon), /• velov — Vélo'V \(Lyon, FR\)/);
  const near = await gladys.fake.action(ACTIONS.SEARCH_NETWORK, {});
  assert.match(message(near).split('\n')[1], /^• velib — .* · \d/);
  const none = await gladys.fake.action(ACTIONS.SEARCH_NETWORK, { query: 'Atlantis' });
  assert.equal(message(none), 'Nothing matches “Atlantis”.');

  const station = await gladys.fake.action(ACTIONS.SEARCH_STATION, { query: 'houssaye' });
  assert.match(message(station, 'de'), /Vélib' Métropole: 2 Station\(en\)/);
  assert.match(message(station, 'de'), /• 8028 — Arsène Houssaye - Champs-Elysées: \d+ Räder/);
  const short = await gladys.fake.action(ACTIONS.SEARCH_STATION, { query: 'a' });
  assert.match(message(short), /at least two/);

  const diagnostic = await gladys.fake.action(ACTIONS.DIAGNOSTIC);
  assert.match(message(diagnostic), /1 line/);
});

test('a configuration change reads the new network, the house kept out of the logs', async () => {
  const lines = [];
  const logger = { ...silent, info: (line) => lines.push(String(line)) };
  const gladys = createFakeGladys({ config: CONFIG, houses: [HOUSE] });
  const app = createApp(gladys, {
    fetch: fakeCityBikes(),
    storePath: storePath(),
    now: () => NOW,
    timers: false,
    logger,
  });
  await gladys.connect();
  await app.whenReady();
  await gladys.fake.configUpdated({ network: 'vlille', stations: '', nearby: '0' });
  assert.equal(app.getNetwork().id, 'vlille');
  assert.equal(app.getFollowed().length, 0);
  await gladys.fake.action(ACTIONS.DIAGNOSTIC);
  const report = lines.find((line) => line.startsWith('CityBikes diagnostic'));
  assert.ok(report);
  assert.doesNotMatch(report, /48\.87|2\.29/, 'no coordinate of the house');
});

test('the list of the networks is read again after a week', async () => {
  const { app, api, clock } = await startApp();
  clock.now += NETWORKS_MAX_AGE_MS + 1;
  await app.applyConfig();
  assert.equal(api.calls.filter((call) => call.startsWith('/networks?')).length, 2);
});
