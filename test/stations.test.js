// Networks and stations: what the integration keeps of the raw answers, and
// how a typed network or station is found.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  fold,
  safeKey,
  distance,
  parseStation,
  parseNetwork,
  searchNetworks,
  resolveNetwork,
  nearestNetworks,
  nearestStations,
  searchStations,
} from '../src/stations.js';
import { fixture, HOUSE, NETWORKS } from './helpers/fixtures.js';

const velib = fixture('velib.json').network.stations.map(parseStation);
const vlille = fixture('vlille.json').network.stations.map(parseStation);
const nextbike = fixture('nextbike-berlin.json').network.stations.map(parseStation);
const networks = NETWORKS.map(parseNetwork);

test('fold and safeKey', () => {
  assert.equal(fold('  Vélib’   Métropole '), "velib' metropole");
  assert.equal(safeKey('A3AC8DFB-a135_11e9'), 'a3ac8dfb-a135-11e9');
  assert.equal(safeKey('  '), '');
  assert.equal(safeKey('x'.repeat(100)).length, 64);
});

test('distance: about 1.1 km between two points 0.01° of latitude apart', () => {
  const d = distance({ latitude: 48.87, longitude: 2.29 }, { latitude: 48.88, longitude: 2.29 });
  assert.ok(d > 1100 && d < 1120, String(d));
});

test('a Vélib’ station: bikes, e-bikes, mechanical bikes, docks, the uid as key', () => {
  const station = velib.find((s) => s.uid === '22002');
  assert.equal(station.key, '22002');
  assert.equal(station.name, 'Argenson - Château');
  assert.equal(station.bikes, station.ebikes + station.mechanical);
  assert.equal(typeof station.docks, 'number');
  assert.equal(station.open, true);
  assert.ok(station.updatedAt > 0);
});

test('a V’Lille station has no e-bike count; a nextbike one may have no dock count', () => {
  assert.ok(vlille.every((s) => s.ebikes === null && s.mechanical !== null));
  assert.ok(nextbike.some((s) => s.docks === null));
  assert.ok(nextbike.every((s) => s.ebikes === null && s.mechanical === null));
});

test('renting, returning and online flags make a station closed', () => {
  const raw = { id: 'abc', name: 'X', free_bikes: 3, empty_slots: 2, extra: { uid: 7 } };
  assert.equal(parseStation(raw).open, true);
  assert.equal(parseStation({ ...raw, extra: { uid: 7, renting: 0 } }).open, false);
  assert.equal(parseStation({ ...raw, extra: { uid: 7, online: false } }).returning, false);
  assert.equal(parseStation({ ...raw, extra: { uid: 7, returning: false } }).renting, true);
  assert.equal(parseStation({ ...raw, extra: { has_ebikes: true } }).ebikes, 0);
  assert.equal(parseStation({ ...raw, extra: {} }).key, 'abc', 'the id without uid');
  assert.equal(parseStation({ name: 'no id', extra: {} }), null);
  assert.equal(parseStation({ ...raw, free_bikes: null }).bikes, 0);
});

test('networks: parsed, found by id, name, city, operator', () => {
  const velibNetwork = networks.find((n) => n.id === 'velib');
  assert.deepEqual(
    { city: velibNetwork.city, country: velibNetwork.country, company: velibNetwork.company },
    { city: 'Paris', country: 'FR', company: 'Smovengo' },
  );
  assert.equal(resolveNetwork(networks, 'velib').id, 'velib');
  assert.equal(resolveNetwork(networks, 'VELIB').id, 'velib');
  assert.equal(resolveNetwork(networks, 'Paris').id, 'velib');
  assert.equal(resolveNetwork(networks, 'Lyon').id, 'velov');
  assert.equal(resolveNetwork(networks, "vélo'v").id, 'velov');
  assert.equal(resolveNetwork(networks, 'Nowhere'), null);
  assert.equal(resolveNetwork(networks, ''), null);
  assert.equal(searchNetworks(networks, 'nextbike')[0].id, 'nextbike-berlin');
  assert.deepEqual(searchNetworks(networks, '  '), []);
});

test('the nearest network and stations of a house in Paris', () => {
  assert.equal(nearestNetworks(networks, HOUSE, 1)[0].id, 'velib');
  const near = nearestStations(velib, HOUSE, 3);
  assert.equal(near.length, 3);
  assert.ok(near[0].distance <= near[1].distance && near[1].distance <= near[2].distance);
  const withBike = nearestStations(velib, HOUSE, 20, (s) => s.bikes > 0);
  assert.ok(withBike.every((s) => s.bikes > 0));
});

test('stations: found by uid, exact name, or words of the name', () => {
  assert.deepEqual(
    searchStations(velib, '22002').map((s) => s.uid),
    ['22002'],
  );
  assert.deepEqual(
    searchStations(velib, 'argenson - chateau').map((s) => s.uid),
    ['22002'],
  );
  assert.ok(searchStations(velib, 'arsene houssaye').length >= 2, 'two words, two stations');
  assert.deepEqual(searchStations(velib, 'nulle part'), []);
  assert.deepEqual(searchStations(velib, ''), []);
});
