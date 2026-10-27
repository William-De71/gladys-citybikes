// -----------------------------------------------------------------------------
// The devices of the integration, offered on the Discovery screen.
//
// "<station> (<network>)": one per followed station — typed in the form or
// among the nearest to the house. Read-only `counter-sensor` / `integer`
// features, each only when the operator gives it:
//   - `bikes`        the bikes available, every kind;
//   - `ebikes`       the e-bikes available among them;
//   - `mechanical`   the mechanical bikes available among them;
//   - `docks`        the free docks, to return a bike.
//
// External id: the network id and the operator's id of the station
// (`ext:citybikes:station:velib_22002`). `should_poll` stays false: the
// integration reads the network on its own timer.
// -----------------------------------------------------------------------------

import { DEVICE_FEATURE_CATEGORIES, DEVICE_FEATURE_TYPES } from '@gladysassistant/integration-sdk';
import { t } from './i18n.js';
import { safeKey } from './stations.js';

const DEVICE_TYPE = 'station';
const FEATURE_KEYS = {
  BIKES: 'bikes',
  EBIKES: 'ebikes',
  MECHANICAL: 'mechanical',
  DOCKS: 'docks',
};
// The largest stations hold about a hundred docks: 999 never cuts a count.
const MAX_COUNT = 999;

/**
 * @description The key of a station in a network: "velib_22002".
 * @param {string} networkId - The network id.
 * @param {string} stationKey - The station key (parseStation).
 * @returns {string} The key.
 */
const stationKeyOf = (networkId, stationKey) => `${safeKey(networkId, 80)}_${stationKey}`;

/**
 * @description The external ids of a followed station.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {string} key - The key (stationKeyOf).
 * @returns {{ device: string, feature: Function }} The ids.
 */
const idsOf = (gladys, key) => gladys.externalIds(DEVICE_TYPE, key);

/**
 * @description The station key a device (or feature) external id stands for.
 * @param {unknown} externalId - An external id.
 * @returns {string|null} "velib_22002".
 * @example
 * parseExternalId('ext:citybikes:station:velib_22002:bikes'); // -> 'velib_22002'
 */
function parseExternalId(externalId) {
  const match = /:station:([a-z0-9_-]+)(?::[a-z_]+)?$/.exec(String(externalId ?? ''));
  return match ? match[1] : null;
}

const counter = (name, externalId) => ({
  name,
  external_id: externalId,
  category: DEVICE_FEATURE_CATEGORIES.COUNTER_SENSOR,
  type: DEVICE_FEATURE_TYPES.SENSOR.INTEGER,
  read_only: true,
  has_feedback: false,
  keep_history: true,
  min: 0,
  max: MAX_COUNT,
});

/**
 * @description The features a station gives.
 * @param {object} station - The station (parseStation).
 * @returns {string[]} FEATURE_KEYS values, `bikes` always.
 */
function featuresOf(station) {
  return [
    FEATURE_KEYS.BIKES,
    station.ebikes !== null ? FEATURE_KEYS.EBIKES : null,
    station.mechanical !== null ? FEATURE_KEYS.MECHANICAL : null,
    station.docks !== null ? FEATURE_KEYS.DOCKS : null,
  ].filter(Boolean);
}

const FEATURE_NAMES = {
  bikes: 'featureBikes',
  ebikes: 'featureEbikes',
  mechanical: 'featureMechanical',
  docks: 'featureDocks',
};

/**
 * @description Build the device of a followed station.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {object} followed - `{ key, network, station }`.
 * @param {string} [language] - Language of the feature names.
 * @returns {object} The discovered device.
 */
function buildStationDevice(gladys, followed, language = 'en') {
  const ids = idsOf(gladys, followed.key);
  const { station, network } = followed;
  return {
    name: t('stationDeviceName', language, { station: station.name, network: network.name }),
    external_id: ids.device,
    model: network.name.slice(0, 60) || 'CityBikes',
    should_poll: false,
    params: [
      { name: 'CITYBIKES_NETWORK', value: network.id },
      { name: 'CITYBIKES_STATION', value: station.uid || station.id },
    ],
    features: featuresOf(station).map((key) =>
      counter(t(FEATURE_NAMES[key], language), ids.feature(key)),
    ),
  };
}

/**
 * @description The states of a followed station.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {object} followed - `{ key, station }`, `station` the last reading.
 * @returns {Array<{ device_feature_external_id: string, state: number }>} The states.
 */
function buildStationStates(gladys, followed) {
  const ids = idsOf(gladys, followed.key);
  const { station } = followed;
  const values = {
    bikes: station.bikes,
    ebikes: station.ebikes,
    mechanical: station.mechanical,
    docks: station.docks,
  };
  return featuresOf(station).map((key) => ({
    device_feature_external_id: ids.feature(key),
    state: Math.min(MAX_COUNT, values[key]),
  }));
}

export {
  DEVICE_TYPE,
  FEATURE_KEYS,
  MAX_COUNT,
  stationKeyOf,
  idsOf,
  parseExternalId,
  featuresOf,
  buildStationDevice,
  buildStationStates,
};
