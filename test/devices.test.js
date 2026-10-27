// The discovered devices, checked against what Gladys needs but does not
// always say (fil 11005): min / max / read_only / has_feedback on every
// feature, should_poll explicit and false without poll_frequency, valid
// category / type pairs, stable external ids.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEVICE_FEATURE_CATEGORIES, DEVICE_FEATURE_TYPES } from '@gladysassistant/integration-sdk';

import {
  buildStationDevice,
  buildStationStates,
  stationKeyOf,
  parseExternalId,
  featuresOf,
  FEATURE_KEYS,
  MAX_COUNT,
} from '../src/device.js';
import { parseStation } from '../src/stations.js';
import { LANGUAGES } from '../src/i18n.js';
import { fakeGladys, fixture } from './helpers/fixtures.js';

const velib = { id: 'velib', name: "Vélib' Métropole" };
const station = (file, index = 0) => parseStation(fixture(file).network.stations[index]);
const followed = (network, s) => ({ key: stationKeyOf(network.id, s.key), network, station: s });

test('a Vélib’ station: four counters, every field Gladys needs', () => {
  for (const language of LANGUAGES) {
    const device = buildStationDevice(fakeGladys, followed(velib, station('velib.json')), language);
    assert.equal(device.external_id, 'ext:citybikes:station:velib_22002');
    assert.equal(device.name, "Argenson - Château (Vélib' Métropole)");
    assert.equal(device.should_poll, false);
    assert.equal(device.poll_frequency, undefined);
    assert.deepEqual(
      device.features.map((f) => f.external_id.split(':').pop()),
      Object.values(FEATURE_KEYS),
    );
    for (const feature of device.features) {
      assert.equal(feature.category, DEVICE_FEATURE_CATEGORIES.COUNTER_SENSOR);
      assert.equal(feature.type, DEVICE_FEATURE_TYPES.SENSOR.INTEGER);
      assert.deepEqual(
        [feature.min, feature.max, feature.read_only, feature.has_feedback],
        [0, MAX_COUNT, true, false],
      );
      assert.ok(feature.name.length > 0 && feature.name.length <= 50, feature.name);
    }
  }
});

test('the features the operator gives only', () => {
  assert.deepEqual(featuresOf(station('vlille.json')), ['bikes', 'mechanical', 'docks']);
  const noDock = fixture('nextbike-berlin.json')
    .network.stations.map(parseStation)
    .find((s) => s.docks === null);
  assert.deepEqual(featuresOf(noDock), ['bikes']);
});

test('states: one per feature, capped', () => {
  const s = { ...station('velib.json'), bikes: 1500 };
  const states = buildStationStates(fakeGladys, followed(velib, s));
  assert.equal(states.length, 4);
  assert.equal(states[0].state, MAX_COUNT);
  states.forEach((state) => assert.ok(Number.isInteger(state.state)));
});

test('external ids read back', () => {
  assert.equal(stationKeyOf('nextbike-berlin', 'a3ac8dfb-a135'), 'nextbike-berlin_a3ac8dfb-a135');
  assert.equal(parseExternalId('ext:citybikes:station:velib_22002'), 'velib_22002');
  assert.equal(parseExternalId('ext:citybikes:station:velib_22002:docks'), 'velib_22002');
  assert.equal(parseExternalId('nope'), null);
});
