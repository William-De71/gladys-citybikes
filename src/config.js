// -----------------------------------------------------------------------------
// Configuration of the CityBikes integration.
//
// Fields of the config_schema (the API needs no key):
//   - `network`    the bike sharing network: its CityBikes id ("velib"), its
//                  name or its city; empty for the network nearest to the
//                  house;
//   - `house`      the house the nearest network and stations are counted
//                  from (a selector of Gladys); empty for the first located
//                  house;
//   - `stations`   the followed stations, separated by commas or semicolons:
//                  their ids ("22002", given by "Find a station") or names;
//   - `nearby`     how many stations nearest to the house are followed too
//                  (0 for none);
//   - `interval`   seconds between two readings of the network;
//   - `language`   language of the texts Gladys does not ask for in a
//                  language (feature names, scene summaries): `auto` follows
//                  the last widget request.
//
// Internal key, outside the config_schema (stored by setConfig):
//   - `last_language`   language of the last widget request.
// -----------------------------------------------------------------------------

import { isLanguage } from './i18n.js';

// Twenty stations and the nearest five: far beyond a home and a workplace.
const MAX_STATIONS = 20;
const NEARBY = [0, 1, 2, 3, 5];
const DEFAULT_NEARBY = 3;
const INTERVALS = [60, 120, 300, 600];
const DEFAULT_INTERVAL = 120;
const AUTO_LANGUAGE = 'auto';
const INTERNAL_KEYS = { language: 'last_language' };

const readString = (raw) => (typeof raw === 'string' ? raw.trim() : '');

/**
 * @description Read a value among allowed numbers.
 * @param {unknown} raw - The raw value ("120", 120).
 * @param {number[]} allowed - The allowed values.
 * @param {number} fallback - The default.
 * @returns {number} The value.
 */
function readChoice(raw, allowed, fallback) {
  if (raw === undefined || raw === null || raw === '') {
    return fallback;
  }
  const value = Number(raw);
  return allowed.includes(value) ? value : fallback;
}

/**
 * @description Split the stations typed by hand.
 * @param {unknown} raw - "22002, Argenson - Château ; 16107".
 * @returns {string[]} The entries, without duplicates, MAX_STATIONS at most.
 * @example
 * parseStations('22002, 16107;22002'); // -> ['22002', '16107']
 */
function parseStations(raw) {
  const seen = new Set();
  return readString(raw)
    .split(/[,;\n]+/)
    .map((entry) => entry.trim().slice(0, 100))
    .filter((entry) => {
      const key = entry.toLowerCase();
      if (!entry || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .slice(0, MAX_STATIONS);
}

/**
 * @description Normalize the raw config object from the host API.
 * @param {object} [rawConfig] - The raw config values.
 * @returns {object} `{ network, house, stations, nearby, interval, language }`.
 * @example
 * normalizeConfig({ network: 'velib', stations: '22002' });
 */
function normalizeConfig(rawConfig = {}) {
  const config = rawConfig ?? {};
  return {
    network: readString(config.network).slice(0, 80),
    house: readString(config.house),
    stations: parseStations(config.stations),
    nearby: readChoice(config.nearby, NEARBY, DEFAULT_NEARBY),
    interval: readChoice(config.interval, INTERVALS, DEFAULT_INTERVAL),
    language: isLanguage(config.language) ? config.language : AUTO_LANGUAGE,
  };
}

/**
 * @description Read the stored language of the last request.
 * @param {object} [rawConfig] - The raw config values.
 * @param {string} fallback - The language to keep when nothing valid is stored.
 * @returns {string} The language.
 * @example
 * readLanguage({ last_language: 'fr' }, 'en'); // -> 'fr'
 */
function readLanguage(rawConfig, fallback) {
  const language = (rawConfig ?? {})[INTERNAL_KEYS.language];
  return typeof language === 'string' && /^[a-z]{2}$/.test(language) ? language : fallback;
}

export {
  MAX_STATIONS,
  NEARBY,
  DEFAULT_NEARBY,
  INTERVALS,
  DEFAULT_INTERVAL,
  AUTO_LANGUAGE,
  INTERNAL_KEYS,
  parseStations,
  normalizeConfig,
  readLanguage,
};
