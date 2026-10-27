// -----------------------------------------------------------------------------
// Scene triggers and scene action outputs of the CityBikes integration.
//
// Triggers, one event per transition of a followed station between two
// readings (never a periodic snapshot):
//   - `bikes_available`    no bike, then at least one;
//   - `station_empty`      at least one bike, then none;
//   - `ebikes_available`   no e-bike, then at least one (stations whose
//                          operator counts the e-bikes);
//   - `ebikes_gone`        at least one e-bike, then none;
//   - `docks_available`    no free dock, then at least one;
//   - `station_full`       at least one free dock, then none (no bike can be
//                          returned there).
// The first reading of a station is a baseline: nothing fires. A closed
// station counts as without bike and without dock.
// -----------------------------------------------------------------------------

import { t } from './i18n.js';

const TRIGGERS = {
  BIKES_AVAILABLE: 'bikes_available',
  STATION_EMPTY: 'station_empty',
  EBIKES_AVAILABLE: 'ebikes_available',
  EBIKES_GONE: 'ebikes_gone',
  DOCKS_AVAILABLE: 'docks_available',
  STATION_FULL: 'station_full',
};

const STATION_OUTPUTS = [
  'station_name',
  'found',
  'open',
  'bikes',
  'ebikes',
  'mechanical',
  'docks',
  'summary',
];
const FIND_OUTPUTS = ['found', 'station_name', 'distance', 'bikes', 'ebikes', 'docks', 'summary'];
const FIND_KINDS = { BIKE: 'bike', EBIKE: 'ebike', DOCK: 'dock' };

/**
 * @description What the triggers compare between two readings.
 * @param {object} station - The station (parseStation).
 * @returns {{ bikes: number, ebikes: number|null, docks: number|null }} The
 * counts; a closed station has none.
 */
function countsOf(station) {
  return {
    bikes: station.renting ? station.bikes : 0,
    ebikes: station.ebikes === null ? null : station.renting ? station.ebikes : 0,
    docks: station.docks === null ? null : station.returning ? station.docks : 0,
  };
}

const value = (count) => (count === null || count === undefined ? -1 : count);

/**
 * @description The data of an event: flat, scalar values.
 * @param {object} followed - `{ deviceId, network, station }`.
 * @returns {object} The data.
 */
function eventData({ deviceId, network, station }) {
  const counts = countsOf(station);
  return {
    // The `station` field of the triggers filters on the device.
    station: deviceId,
    station_name: station.name.slice(0, 200),
    network_name: network.name.slice(0, 200),
    bikes: counts.bikes,
    ebikes: value(counts.ebikes),
    mechanical: value(station.mechanical),
    docks: value(counts.docks),
  };
}

/**
 * @description The events between two readings of a station.
 * @param {object|null} before - The counts of the previous reading (countsOf),
 * null for the first one.
 * @param {object} followed - `{ deviceId, network, station }`, the new reading.
 * @returns {Array<{ key: string, data: object }>} The events.
 */
function detectStationEvents(before, followed) {
  if (!before) {
    return [];
  }
  const after = countsOf(followed.station);
  const keys = [];
  const edge = (field, up, down) => {
    const was = before[field];
    const now = after[field];
    if (was === null || was === undefined || now === null) {
      return;
    }
    if (was === 0 && now > 0) {
      keys.push(up);
    } else if (was > 0 && now === 0) {
      keys.push(down);
    }
  };
  edge('bikes', TRIGGERS.BIKES_AVAILABLE, TRIGGERS.STATION_EMPTY);
  edge('ebikes', TRIGGERS.EBIKES_AVAILABLE, TRIGGERS.EBIKES_GONE);
  edge('docks', TRIGGERS.DOCKS_AVAILABLE, TRIGGERS.STATION_FULL);
  if (keys.length === 0) {
    return [];
  }
  const data = eventData(followed);
  return keys.map((key) => ({ key, data }));
}

/**
 * @description One sentence on a station: "Argenson - Château: 13 bikes
 * (6 e-bikes), 12 free docks."
 * @param {object} station - The station.
 * @param {string} language - The language.
 * @returns {string} The sentence.
 */
function stationSentence(station, language) {
  if (!station.open) {
    return t('summaryClosed', language, { station: station.name });
  }
  const parts = [t('countBikes', language, { n: station.bikes })];
  if (station.ebikes !== null) {
    parts[0] += ` (${t('countEbikes', language, { n: station.ebikes })})`;
  }
  if (station.docks !== null) {
    parts.push(t('countDocks', language, { n: station.docks }));
  }
  return t('summaryStation', language, { station: station.name, counts: parts.join(', ') });
}

/**
 * @description The outputs of the "read a station" scene action.
 * @param {object|null} station - The station, null when the network does not
 * list it any more.
 * @param {object} options - `{ name, language }`.
 * @returns {object} The outputs.
 */
function stationOutputs(station, { name, language }) {
  if (!station) {
    return {
      station_name: name,
      found: false,
      open: false,
      bikes: 0,
      ebikes: -1,
      mechanical: -1,
      docks: -1,
      summary: t('summaryMissing', language, { station: name }),
    };
  }
  return {
    station_name: station.name,
    found: true,
    open: station.open,
    bikes: station.bikes,
    ebikes: value(station.ebikes),
    mechanical: value(station.mechanical),
    docks: value(station.docks),
    summary: stationSentence(station, language),
  };
}

/**
 * @description Whether a station answers a search ("a bike", "an e-bike",
 * "a free dock").
 * @param {string} kind - FIND_KINDS.
 * @returns {Function} `(station) => boolean`.
 */
function wanted(kind) {
  if (kind === FIND_KINDS.EBIKE) {
    return (station) => station.renting && (station.ebikes ?? 0) > 0;
  }
  if (kind === FIND_KINDS.DOCK) {
    return (station) => station.returning && (station.docks ?? 0) > 0;
  }
  return (station) => station.renting && station.bikes > 0;
}

/**
 * @description The outputs of the "find the nearest station" scene action.
 * @param {object|null} station - The nearest station found, with its
 * `distance`, null when none.
 * @param {object} options - `{ kind, language }`.
 * @returns {object} The outputs.
 */
function findOutputs(station, { kind, language }) {
  if (!station) {
    return {
      found: false,
      station_name: '',
      distance: -1,
      bikes: 0,
      ebikes: -1,
      docks: -1,
      summary: t(`findNone_${kind}`, language),
    };
  }
  return {
    found: true,
    station_name: station.name,
    distance: station.distance,
    bikes: station.bikes,
    ebikes: value(station.ebikes),
    docks: value(station.docks),
    summary: t('findSummary', language, {
      sentence: stationSentence(station, language),
      distance: distanceText(station.distance, language),
    }),
  };
}

/**
 * @description A distance for a person: "350 m", "1.2 km".
 * @param {number} metres - The distance.
 * @param {string} language - The language.
 * @returns {string} The text.
 */
function distanceText(metres, language) {
  if (metres < 1000) {
    return `${Math.round(metres / 10) * 10} m`;
  }
  const km = (metres / 1000).toFixed(metres < 10000 ? 1 : 0);
  return `${language === 'en' ? km : km.replace('.', ',')} km`;
}

/**
 * @description Keep only the declared outputs.
 * @param {object} outputs - The outputs.
 * @param {string[]} keys - The declared keys.
 * @returns {object} The outputs.
 */
const pick = (outputs, keys) => Object.fromEntries(keys.map((key) => [key, outputs[key]]));

export {
  TRIGGERS,
  STATION_OUTPUTS,
  FIND_OUTPUTS,
  FIND_KINDS,
  countsOf,
  eventData,
  detectStationEvents,
  stationSentence,
  stationOutputs,
  wanted,
  findOutputs,
  distanceText,
  pick,
};
