// The configuration: defaults, bounds, the stations typed by hand.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeConfig,
  parseStations,
  readLanguage,
  MAX_STATIONS,
  DEFAULT_INTERVAL,
  DEFAULT_NEARBY,
} from '../src/config.js';

test('defaults: no network, no station, the 3 nearest, every 2 minutes, automatic language', () => {
  assert.deepEqual(normalizeConfig(), {
    network: '',
    house: '',
    stations: [],
    nearby: DEFAULT_NEARBY,
    interval: DEFAULT_INTERVAL,
    language: 'auto',
  });
  assert.deepEqual(normalizeConfig(null).stations, []);
});

test('reads the values of the form, and refuses the ones it does not offer', () => {
  const config = normalizeConfig({
    network: ' velib ',
    house: 'maison',
    stations: '22002',
    nearby: '0',
    interval: '600',
    language: 'de',
  });
  assert.deepEqual(config, {
    network: 'velib',
    house: 'maison',
    stations: ['22002'],
    nearby: 0,
    interval: 600,
    language: 'de',
  });
  const wrong = normalizeConfig({ nearby: '4', interval: '30', language: 'it' });
  assert.equal(wrong.nearby, DEFAULT_NEARBY);
  assert.equal(wrong.interval, DEFAULT_INTERVAL);
  assert.equal(wrong.language, 'auto');
});

test('stations: commas, semicolons and lines, no duplicates, twenty at most', () => {
  assert.deepEqual(parseStations('22002, Argenson - Château ;8057\n22002'), [
    '22002',
    'Argenson - Château',
    '8057',
  ]);
  assert.deepEqual(parseStations(42), []);
  const many = Array.from({ length: 30 }, (_, i) => String(i)).join(',');
  assert.equal(parseStations(many).length, MAX_STATIONS);
});

test('the stored language', () => {
  assert.equal(readLanguage({ last_language: 'fr' }, 'en'), 'fr');
  assert.equal(readLanguage({ last_language: 'french' }, 'en'), 'en');
  assert.equal(readLanguage(undefined, 'es'), 'es');
});
