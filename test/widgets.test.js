// Dashboard widgets: every content passes the validator of the SDK, in every
// language, and credits CityBikes.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent, WIDGET_COLORS } from '@gladysassistant/integration-sdk';

import {
  buildStationsWidget,
  buildNearbyWidget,
  messageContent,
  countColor,
  readCount,
  readShow,
  NEARBY_COUNT,
} from '../src/widgets.js';
import { parseStation } from '../src/stations.js';
import { LANGUAGES, t } from '../src/i18n.js';
import { fixture, NOW, TZ } from './helpers/fixtures.js';

const stations = fixture('velib.json').network.stations.map(parseStation);
const network = { id: 'velib', name: "Vélib' Métropole" };
const valid = (content) => assert.deepEqual(validateWidgetContent(content), []);
const credited = (content) =>
  assert.ok(content.components.some((c) => c.type === 'text' && /citybik\.es/.test(c.text)));

test('one station: three tiles and the credit', () => {
  for (const language of LANGUAGES) {
    const content = buildStationsWidget({
      stations: [{ name: 'x', station: stations[0] }],
      readAt: NOW,
      language,
      timeZone: TZ,
    });
    valid(content);
    credited(content);
    assert.equal(content.components.filter((c) => c.type === 'value').length, 3);
    assert.match(content.components.at(-1).text, /23:00$/);
  }
});

test('one station without e-bike and dock counts, closed: one tile and a state', () => {
  const content = buildStationsWidget({
    stations: [
      {
        name: 'x',
        station: { ...stations[0], ebikes: null, docks: null, open: false, renting: false },
      },
    ],
    readAt: NOW,
    language: 'fr',
    timeZone: TZ,
  });
  valid(content);
  assert.equal(content.components.filter((c) => c.type === 'value').length, 1);
  assert.equal(content.components.find((c) => c.type === 'status').items[0].value, 'Fermée');
});

test('several stations: a row each, a badge colored by the bikes left; a missing one', () => {
  for (const language of LANGUAGES) {
    const content = buildStationsWidget({
      stations: [
        { name: 'Removed', station: null },
        ...stations.map((station) => ({ name: station.name, station })),
      ],
      readAt: NOW,
      language,
      timeZone: TZ,
    });
    valid(content);
    const list = content.components.find((c) => c.type === 'card-list');
    assert.equal(list.items.length, 8, 'eight rows at most');
    assert.equal(list.items[0].subtitle, t('stationMissing', language));
    assert.equal(list.items[1].title, stations[0].name, 'the whole name');
    assert.equal(list.items[2].badge.color, 'danger', 'no bike left');
  }
});

test('nearby: a list with distances, in every language', () => {
  for (const language of LANGUAGES) {
    const near = stations
      .slice(0, 5)
      .map((station, i) => ({ ...station, distance: 150 * (i + 1) }));
    const content = buildNearbyWidget({
      stations: near,
      network,
      readAt: NOW,
      show: 'all',
      language,
      timeZone: TZ,
    });
    valid(content);
    credited(content);
    const list = content.components.find((c) => c.type === 'card-list');
    assert.equal(list.items.length, 5);
    assert.match(list.items[0].subtitle, /^150 m · /);
  }
  const none = buildNearbyWidget({
    stations: [],
    network,
    readAt: NOW,
    show: 'ebike',
    language: 'en',
  });
  valid(none);
  assert.match(none.components[0].text, /e-bike/);
});

test('messages, colors and settings', () => {
  valid(messageContent('Hello'));
  valid(buildStationsWidget({ stations: [], readAt: NOW, language: 'es' }));
  assert.equal(countColor(0, true), WIDGET_COLORS.DANGER);
  assert.equal(countColor(2, true), WIDGET_COLORS.WARNING);
  assert.equal(countColor(9, true), WIDGET_COLORS.SUCCESS);
  assert.equal(countColor(9, false), WIDGET_COLORS.NEUTRAL);
  assert.equal(readCount(undefined, NEARBY_COUNT), 5);
  assert.equal(readCount('40', NEARBY_COUNT), 8);
  assert.equal(readShow('dock'), 'dock');
  assert.equal(readShow('cars'), 'all');
});
