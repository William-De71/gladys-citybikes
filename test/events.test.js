// Scene triggers (one event per transition, a baseline first) and the
// outputs of the scene actions.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  TRIGGERS,
  STATION_OUTPUTS,
  FIND_OUTPUTS,
  countsOf,
  detectStationEvents,
  stationOutputs,
  findOutputs,
  distanceText,
  wanted,
  pick,
} from '../src/events.js';

const station = (fields = {}) => ({
  key: '22002',
  uid: '22002',
  name: 'Argenson - Château',
  bikes: 5,
  ebikes: 2,
  mechanical: 3,
  docks: 10,
  open: true,
  renting: true,
  returning: true,
  ...fields,
});
const entry = (fields) => ({
  deviceId: 'ext:citybikes:station:velib_22002',
  network: { id: 'velib', name: "Vélib' Métropole" },
  station: station(fields),
});
const keysOf = (events) => events.map((event) => event.key);

test('the first reading is a baseline: nothing fires', () => {
  assert.deepEqual(detectStationEvents(null, entry({ bikes: 0 })), []);
});

test('no bike, then bikes; bikes, then none', () => {
  const empty = countsOf(station({ bikes: 0, ebikes: 0, mechanical: 0 }));
  assert.deepEqual(keysOf(detectStationEvents(empty, entry())), [
    TRIGGERS.BIKES_AVAILABLE,
    TRIGGERS.EBIKES_AVAILABLE,
  ]);
  assert.deepEqual(
    keysOf(detectStationEvents(countsOf(station()), entry({ bikes: 0, ebikes: 0, mechanical: 0 }))),
    [TRIGGERS.STATION_EMPTY, TRIGGERS.EBIKES_GONE],
  );
  assert.deepEqual(detectStationEvents(countsOf(station()), entry({ bikes: 7 })), []);
});

test('the e-bikes alone, and the docks', () => {
  const before = countsOf(station());
  assert.deepEqual(keysOf(detectStationEvents(before, entry({ ebikes: 0 }))), [
    TRIGGERS.EBIKES_GONE,
  ]);
  assert.deepEqual(keysOf(detectStationEvents(before, entry({ docks: 0 }))), [
    TRIGGERS.STATION_FULL,
  ]);
  assert.deepEqual(keysOf(detectStationEvents(countsOf(station({ docks: 0 })), entry())), [
    TRIGGERS.DOCKS_AVAILABLE,
  ]);
});

test('unknown counts never fire; a closed station has no bike and no dock', () => {
  const noCount = countsOf(station({ ebikes: null, docks: null }));
  assert.deepEqual(detectStationEvents(noCount, entry({ ebikes: 0, docks: 0, bikes: 5 })), []);
  const closed = entry({ open: false, renting: false, returning: false });
  assert.deepEqual(keysOf(detectStationEvents(countsOf(station()), closed)), [
    TRIGGERS.STATION_EMPTY,
    TRIGGERS.EBIKES_GONE,
    TRIGGERS.STATION_FULL,
  ]);
});

test('the data of an event: flat scalars, the device as filter, -1 when unknown', () => {
  const [event] = detectStationEvents(
    countsOf(station({ bikes: 0, ebikes: null, mechanical: null })),
    entry({ ebikes: null, mechanical: null }),
  );
  assert.deepEqual(event.data, {
    station: 'ext:citybikes:station:velib_22002',
    station_name: 'Argenson - Château',
    network_name: "Vélib' Métropole",
    bikes: 5,
    ebikes: -1,
    mechanical: -1,
    docks: 10,
  });
  for (const value of Object.values(event.data)) {
    assert.ok(['string', 'number', 'boolean'].includes(typeof value));
  }
});

test('read a station: its counts and a sentence in four languages', () => {
  const outputs = pick(stationOutputs(station(), { name: 'x', language: 'fr' }), STATION_OUTPUTS);
  assert.deepEqual(Object.keys(outputs), STATION_OUTPUTS);
  assert.equal(outputs.summary, 'Argenson - Château : 5 vélos (2 électriques), 10 places.');
  assert.equal(
    stationOutputs(station({ bikes: 1, ebikes: 1, docks: 1 }), { language: 'en' }).summary,
    'Argenson - Château: 1 bike (1 e-bike), 1 free dock.',
  );
  assert.match(stationOutputs(station({ open: false }), { language: 'de' }).summary, /geschlossen/);
  const missing = stationOutputs(null, { name: 'Gone', language: 'es' });
  assert.equal(missing.found, false);
  assert.match(missing.summary, /Gone/);
});

test('find a station: the kind wanted, the distance, nothing found', () => {
  assert.equal(wanted('ebike')(station({ ebikes: 0 })), false);
  assert.equal(wanted('dock')(station({ returning: false })), false);
  assert.equal(wanted('bike')(station()), true);
  const found = pick(
    findOutputs({ ...station(), distance: 1234 }, { kind: 'bike', language: 'fr' }),
    FIND_OUTPUTS,
  );
  assert.deepEqual(Object.keys(found), FIND_OUTPUTS);
  assert.match(found.summary, /À 1,2 km\.$/);
  const none = findOutputs(null, { kind: 'dock', language: 'en' });
  assert.deepEqual([none.found, none.distance], [false, -1]);
  assert.equal(none.summary, 'No station with a free dock nearby.');
});

test('distances for a person', () => {
  assert.equal(distanceText(194, 'fr'), '190 m');
  assert.equal(distanceText(1234, 'en'), '1.2 km');
  assert.equal(distanceText(12345, 'de'), '12 km');
});
