// The manifest against the code: the keys it declares are the ones the code
// handles, the store limits hold, the transport and permissions are right.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

import { TRIGGERS, STATION_OUTPUTS, FIND_OUTPUTS, FIND_KINDS } from '../src/events.js';
import { SCENE_ACTIONS, ACTIONS } from '../src/app.js';
import { WIDGETS, NEARBY_COUNT, SHOW } from '../src/widgets.js';
import {
  AUTO_LANGUAGE,
  INTERVALS,
  DEFAULT_INTERVAL,
  NEARBY,
  DEFAULT_NEARBY,
  INTERNAL_KEYS,
} from '../src/config.js';
import { LANGUAGES } from '../src/i18n.js';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const manifest = read('../gladys-assistant-integration.json');
const pkg = read('../package.json');
const byKey = (list) => new Map(list.map((entry) => [entry.key, entry]));
const values = (field) => field.options.map((option) => option.value);
const source = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('a device integration, in lockstep with package.json, at 0.x until 1.0.0 is decided', () => {
  assert.equal(manifest.type, 'device');
  assert.equal(manifest.name, 'CityBikes');
  assert.equal(manifest.version, pkg.version);
  assert.equal(manifest.docker_image, `ghcr.io/william-de71/gladys-citybikes:${pkg.version}`);
  assert.equal(
    manifest.cover_image,
    'https://raw.githubusercontent.com/William-De71/gladys-citybikes/main/cover.jpg',
  );
  assert.equal(pkg.license, 'Apache-2.0');
  assert.equal(pkg.name, 'gladys-citybikes');
  assert.deepEqual(Object.keys(pkg.dependencies), ['@gladysassistant/integration-sdk']);
});

test('declares the cloud transport only: the CityBikes API', () => {
  assert.deepEqual(manifest.transports, ['cloud']);
  assert.doesNotMatch(source('../src/app.js'), /publishTransports|GLADYS_PREFER_LOCAL/);
  assert.match(source('../src/citybikes-api.js'), /https:\/\/api\.citybik\.es\/v2/);
});

test('requires Gladys 5.3.0 and the location of the house, nothing else', () => {
  assert.equal(manifest.gladys_version, '>=5.3.0');
  assert.deepEqual(manifest.categories, ['transport']);
  assert.equal(manifest.location, true);
  assert.match(source('../src/app.js'), /getHouses\(\)/);
  for (const key of ['network_wake', 'containers', 'network_discovery', 'webhooks']) {
    assert.equal(manifest[key], undefined, key);
  }
  assert.doesNotMatch(source('../src/widgets.js'), /type: 'button'/);
});

test('declares exactly the scene triggers, actions and widgets the code handles', () => {
  assert.deepEqual(
    manifest.scene_triggers.map((trigger) => trigger.key).sort(),
    Object.values(TRIGGERS).sort(),
  );
  assert.deepEqual(
    manifest.scene_actions.map((action) => action.key).sort(),
    Object.values(SCENE_ACTIONS).sort(),
  );
  assert.deepEqual(
    manifest.widgets.map((widget) => widget.key).sort(),
    Object.values(WIDGETS).sort(),
  );
  const app = source('../src/app.js');
  for (const key of Object.keys(WIDGETS)) {
    assert.match(app, new RegExp(`onWidgetGet\\(WIDGETS\\.${key}`), key);
  }
  for (const key of Object.keys(SCENE_ACTIONS)) {
    assert.match(app, new RegExp(`onSceneAction\\(SCENE_ACTIONS\\.${key}`), key);
  }
  assert.deepEqual(
    manifest.actions.map((action) => action.key),
    Object.values(ACTIONS),
  );
  for (const key of Object.keys(ACTIONS)) {
    assert.match(app, new RegExp(`onAction\\(ACTIONS\\.${key}`), key);
  }
});

test('the configuration of the code: no key, network, house, stations, nearby, interval', () => {
  const config = byKey(manifest.config_schema);
  assert.ok(manifest.config_schema.every((field) => field.type !== 'secret'));
  assert.equal(config.get('network').type, 'string');
  assert.equal(config.get('stations').type, 'string');
  assert.equal(config.get('house').source, 'houses');
  const nearby = config.get('nearby');
  assert.deepEqual(values(nearby), NEARBY.map(String));
  assert.equal(nearby.default, String(DEFAULT_NEARBY));
  const interval = config.get('interval');
  assert.deepEqual(values(interval), INTERVALS.map(String));
  assert.equal(interval.default, String(DEFAULT_INTERVAL));
  assert.equal(config.get(INTERNAL_KEYS.language), undefined, 'internal key, never shown');
  for (const field of manifest.config_schema) {
    assert.ok(!['text', 'password', 'number'].includes(field.type), `${field.key}: ${field.type}`);
    assert.equal(field.display_if, undefined, field.key);
  }
  assert.ok(
    config.get('intro').links.some((link) => link.url === 'https://citybik.es/'),
    'the credit the terms of the API ask for',
  );
});

test('the triggers filter by station device and expose the event data', () => {
  for (const trigger of manifest.scene_triggers) {
    const fields = byKey(trigger.fields);
    assert.equal(fields.get('station').source, 'devices', trigger.key);
    assert.deepEqual(
      trigger.variables.map((variable) => variable.key),
      ['station_name', 'network_name', 'bikes', 'ebikes', 'mechanical', 'docks'],
    );
  }
});

test('the scene actions: fields and outputs of the code', () => {
  const actions = byKey(manifest.scene_actions);
  assert.deepEqual(
    actions.get(SCENE_ACTIONS.GET_STATION).outputs.map((output) => output.key),
    STATION_OUTPUTS,
  );
  const find = actions.get(SCENE_ACTIONS.FIND_STATION);
  assert.deepEqual(
    find.outputs.map((output) => output.key),
    FIND_OUTPUTS,
  );
  assert.deepEqual(values(byKey(find.fields).get('kind')), Object.values(FIND_KINDS));
  assert.equal(byKey(find.fields).get('near').source, 'devices');
  const nearby = byKey(byKey(manifest.widgets).get(WIDGETS.NEARBY).settings);
  assert.deepEqual(values(nearby.get('show')), SHOW);
  const count = nearby.get('count');
  assert.deepEqual(
    [count.min, count.max, count.default],
    [NEARBY_COUNT.min, NEARBY_COUNT.max, NEARBY_COUNT.default],
  );
});

test('limits of the store: counts, timeouts, sizes, no secret in widget settings', () => {
  assert.ok(manifest.widgets.length >= 1 && manifest.widgets.length <= 5);
  assert.ok(manifest.scene_triggers.length <= 20);
  assert.ok(manifest.scene_actions.length <= 20);
  for (const trigger of manifest.scene_triggers) {
    assert.ok((trigger.fields ?? []).length <= 10 && trigger.variables.length <= 20, trigger.key);
    assert.ok(trigger.key.length <= 40);
  }
  for (const action of [...manifest.scene_actions, ...manifest.actions]) {
    assert.ok(action.timeout_seconds >= 5 && action.timeout_seconds <= 120, action.key);
    assert.ok(
      (action.fields ?? []).length <= 10 && (action.outputs ?? []).length <= 20,
      action.key,
    );
  }
  for (const widget of manifest.widgets) {
    assert.ok((widget.settings ?? []).length <= 10);
    for (const setting of widget.settings ?? []) {
      assert.ok(!['secret', 'oauth2', 'account_link'].includes(setting.type));
    }
  }
  const size = statSync(new URL('../gladys-assistant-integration.json', import.meta.url)).size;
  assert.ok(size < 100 * 1024, `${size} bytes`);
  const cover = readFileSync(new URL('../cover.jpg', import.meta.url));
  assert.ok(cover.length < 150 * 1024, `cover.jpg: ${cover.length} bytes`);
  assert.equal(cover.readUInt16BE(0), 0xffd8, 'cover.jpg is a JPEG');
});

test('offers the languages of the code, automatic by default', () => {
  const field = byKey(manifest.config_schema).get('language');
  assert.deepEqual(values(field), [AUTO_LANGUAGE, ...LANGUAGES]);
  assert.equal(field.default, AUTO_LANGUAGE);
});

test('catalog keywords; worldwide, so no countries', () => {
  const keywords = manifest.keywords.map((keyword) => keyword.trim().toLowerCase());
  assert.ok(keywords.length >= 1 && keywords.length <= 10, 'one to ten keywords');
  keywords.forEach((keyword) => assert.ok(keyword.length >= 2 && keyword.length <= 30, keyword));
  assert.equal(new Set(keywords).size, keywords.length, 'unique once trimmed and lowercased');
  assert.equal(manifest.countries, undefined, 'networks in the whole world');
});
