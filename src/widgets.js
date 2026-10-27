// -----------------------------------------------------------------------------
// Dashboard widgets of the CityBikes integration.
//
//   - `stations`   the followed stations (all of them, or the devices chosen
//                  in the settings): one station as three tiles — bikes,
//                  e-bikes, free docks —, several as a list (eight at most),
//                  a badge of the bikes left on each row;
//   - `nearby`     the stations nearest to the house, as a list: distance,
//                  bikes, e-bikes, free docks, optionally only those with a
//                  bike, an e-bike or a free dock.
// Every content credits CityBikes and its address (terms of the API) and
// gives the time of the reading.
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { t } from './i18n.js';
import { distanceText } from './events.js';

const WIDGETS = { STATIONS: 'stations', NEARBY: 'nearby' };
const TTL_SECONDS = { content: 60, message: 300 };
const NEARBY_COUNT = { min: 1, max: 8, default: 5 };
const MAX_LIST_ITEMS = 8;
const SHOW = ['all', 'bike', 'ebike', 'dock'];

/**
 * @description Truncate a text to a bound, with an ellipsis.
 * @param {string} value - The text.
 * @param {number} max - The bound.
 * @returns {string} The text.
 * @example
 * clip('Parvis Jules Ferry - Gare Saint-Roch', 20); // -> 'Parvis Jules Ferry …'
 */
function clip(value, max) {
  const text = String(value ?? '');
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * @description Read a bounded integer setting.
 * @param {unknown} raw - The raw setting.
 * @param {{ min: number, max: number, default: number }} bounds - The bounds.
 * @returns {number} The value.
 */
function readCount(raw, bounds) {
  const value = Number(raw);
  if (raw === undefined || raw === null || raw === '' || !Number.isFinite(value)) {
    return bounds.default;
  }
  return Math.min(bounds.max, Math.max(bounds.min, Math.round(value)));
}

/**
 * @description Read the "show" setting of the nearby widget.
 * @param {unknown} raw - The setting.
 * @returns {string} One of SHOW.
 */
const readShow = (raw) => (SHOW.includes(raw) ? raw : 'all');

/**
 * @description A time of day: "22:51".
 * @param {number} at - Epoch milliseconds.
 * @param {string} [timeZone] - The time zone.
 * @returns {string} The time.
 */
function formatTime(at, timeZone) {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    ...(timeZone ? { timeZone } : {}),
  }).format(new Date(at));
}

/**
 * @description A widget content made of one message.
 * @param {string} message - The message.
 * @param {number} [ttl] - Its freshness.
 * @returns {object} The content.
 */
function messageContent(message, ttl = TTL_SECONDS.message) {
  return { ttl_seconds: ttl, components: [{ type: 'text', variant: 'body', text: message }] };
}

/**
 * @description The color of a count: none in red, one or two in orange.
 * @param {number|null} count - The count.
 * @param {boolean} open - Whether the station rents (or takes back) bikes.
 * @returns {string} A WIDGET_COLORS value.
 */
function countColor(count, open) {
  if (!open || count === null) {
    return WIDGET_COLORS.NEUTRAL;
  }
  if (count === 0) {
    return WIDGET_COLORS.DANGER;
  }
  return count <= 2 ? WIDGET_COLORS.WARNING : WIDGET_COLORS.SUCCESS;
}

/**
 * @description The counts of a station, short: "13 bikes (6 e) · 12 docks".
 * @param {object} station - The station.
 * @param {string} language - The language.
 * @returns {string} The text.
 */
function countsText(station, language) {
  if (!station.open) {
    return t('closed', language);
  }
  const bikes = t('countBikes', language, { n: station.bikes });
  const ebikes =
    station.ebikes !== null ? ` (${t('countEbikes', language, { n: station.ebikes })})` : '';
  const docks =
    station.docks !== null ? ` · ${t('countDocks', language, { n: station.docks })}` : '';
  return `${bikes}${ebikes}${docks}`;
}

/**
 * @description A row of a list of stations: its name, its counts, a badge of
 * the bikes left.
 * @param {object|null} station - The station, null when no longer listed.
 * @param {string} name - Its name, for a station no longer listed.
 * @param {string} language - The language.
 * @param {string} [prefix] - Put before the counts ("190 m").
 * @returns {object} The card-list item.
 */
function stationCard(station, name, language, prefix = '') {
  if (!station) {
    return { title: clip(name, 60), subtitle: t('stationMissing', language) };
  }
  return {
    title: clip(station.name, 60),
    subtitle: `${prefix}${countsText(station, language)}`,
    badge: {
      text: clip(station.open ? String(station.bikes) : t('closed', language), 16),
      color: countColor(station.bikes, station.renting),
    },
  };
}

/**
 * @description The credit line: "CityBikes (citybik.es) · 22:51".
 * @param {number} readAt - When the network was read.
 * @param {object} options - `{ language, timeZone }`.
 * @returns {object} The caption component.
 */
const credit = (readAt, { language, timeZone }) => ({
  type: 'text',
  variant: 'caption',
  text: t('credit', language, { time: formatTime(readAt, timeZone) }),
});

/**
 * @description The "stations" widget.
 * @param {object} options - `{ stations: [{ name, station }], readAt,
 * language, timeZone }`; `station` null when the network does not list it
 * any more.
 * @returns {object} The content.
 */
function buildStationsWidget({ stations, readAt, language, timeZone }) {
  if (stations.length === 0) {
    return messageContent(t('widgetNoStation', language));
  }
  const components = [];
  if (stations.length === 1) {
    const [{ name, station }] = stations;
    components.push({ type: 'text', variant: 'heading', text: clip(station?.name ?? name, 40) });
    if (!station) {
      components.push({ type: 'text', variant: 'body', text: t('stationMissing', language) });
    } else {
      const tile = (label, count, icon, open) => ({
        type: 'value',
        label: t(label, language),
        value: count,
        ...(icon ? { icon } : {}),
        color: countColor(count, open),
      });
      components.push(tile('tileBikes', station.bikes, null, station.renting));
      if (station.ebikes !== null) {
        components.push(tile('tileEbikes', station.ebikes, 'zap', station.renting));
      }
      if (station.docks !== null) {
        components.push(tile('tileDocks', station.docks, 'log-in', station.returning));
      }
      if (!station.open) {
        components.push({
          type: 'status',
          items: [
            {
              label: t('stateLabel', language),
              value: t('closed', language),
              color: WIDGET_COLORS.NEUTRAL,
            },
          ],
        });
      }
    }
  } else {
    components.push({
      type: 'card-list',
      display: 'list',
      items: stations
        .slice(0, MAX_LIST_ITEMS)
        .map(({ name, station }) => stationCard(station, name, language)),
    });
  }
  components.push(credit(readAt, { language, timeZone }));
  return { ttl_seconds: TTL_SECONDS.content, components };
}

/**
 * @description The "nearby" widget.
 * @param {object} options - `{ stations (with their distance), network,
 * readAt, show, language, timeZone }`.
 * @returns {object} The content.
 */
function buildNearbyWidget({ stations, network, readAt, show, language, timeZone }) {
  if (stations.length === 0) {
    return messageContent(t(show === 'all' ? 'widgetNoNearby' : `findNone_${show}`, language));
  }
  return {
    ttl_seconds: TTL_SECONDS.content,
    components: [
      {
        type: 'text',
        variant: 'heading',
        text: clip(t('nearbyHeading', language, { network: network.name }), 40),
      },
      {
        type: 'card-list',
        display: 'list',
        items: stations.map((station) =>
          stationCard(
            station,
            station.name,
            language,
            `${distanceText(station.distance, language)} · `,
          ),
        ),
      },
      credit(readAt, { language, timeZone }),
    ],
  };
}

export {
  WIDGETS,
  TTL_SECONDS,
  NEARBY_COUNT,
  SHOW,
  clip,
  readCount,
  readShow,
  formatTime,
  messageContent,
  countColor,
  countsText,
  buildStationsWidget,
  buildNearbyWidget,
};
