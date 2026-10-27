// -----------------------------------------------------------------------------
// Networks and stations of CityBikes, as the integration uses them.
//
// A raw station of the API:
//   { id, name, latitude, longitude, timestamp, free_bikes, empty_slots,
//     extra: { uid, slots, ebikes, normal_bikes, has_ebikes, renting,
//              returning, online, virtual, … } }
// The `extra` fields depend on the operator: Vélib' and Vélo'v give e-bikes
// and mechanical bikes, V'Lille mechanical bikes only, nextbike neither and
// sometimes no free docks (`empty_slots` null). Each is kept only when the
// operator gives it.
//
// The key of a station is the operator's id (`extra.uid`, "22002" at Vélib'),
// else the id of CityBikes: the id of CityBikes is a hash PyBikes may compute
// from the coordinates, which change when a station moves.
// -----------------------------------------------------------------------------

const EARTH_RADIUS_M = 6371000;

/**
 * @description Fold a text for comparisons: lower case, no accents, single
 * spaces.
 * @param {unknown} value - The text.
 * @returns {string} The folded text.
 * @example
 * fold('  Vélib’ Métropole '); // -> "velib' metropole"
 */
function fold(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’`]/g, "'")
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * @description A key safe for an external id: lower case letters, digits and
 * dashes.
 * @param {unknown} value - The raw id.
 * @param {number} [max] - Its longest length.
 * @returns {string} The key ('' for nothing usable).
 * @example
 * safeKey('A3AC8DFB-a135_11e9'); // -> 'a3ac8dfb-a135-11e9'
 */
function safeKey(value, max = 64) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max);
}

/**
 * @description The distance between two points, in metres (haversine).
 * @param {{ latitude: number, longitude: number }} a - A point.
 * @param {{ latitude: number, longitude: number }} b - Another point.
 * @returns {number} The distance, rounded to the metre.
 */
function distance(a, b) {
  const rad = (deg) => (deg * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h))));
}

const count = (value) =>
  value === null || value === undefined || value === '' || !Number.isFinite(Number(value))
    ? null
    : Math.max(0, Math.round(Number(value)));
const flag = (value) =>
  value === undefined || value === null ? null : value === true || value === 1 || value === '1';
const coordinate = (value) => (Number.isFinite(Number(value)) ? Number(value) : null);

/**
 * @description Read a time of the API. CityBikes writes an offset and a "Z"
 * ("2026-10-27T22:51:05.560807+00:00Z"), which Date.parse refuses.
 * @param {unknown} value - The time.
 * @returns {number|null} Epoch milliseconds.
 */
function readTime(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const time = Date.parse(value.replace(/([+-]\d{2}:\d{2})Z$/, '$1'));
  return Number.isFinite(time) ? time : null;
}

/**
 * @description A raw station, as the integration keeps it.
 * @param {object} raw - The station of the API.
 * @returns {object|null} `{ key, id, uid, name, address, latitude, longitude,
 * bikes, ebikes, mechanical, docks, slots, open, renting, returning,
 * updatedAt }`, null without an id. `ebikes`, `mechanical`, `docks` and
 * `slots` are null when the operator does not give them.
 */
function parseStation(raw) {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const extra = raw.extra && typeof raw.extra === 'object' ? raw.extra : {};
  const uid = extra.uid === undefined || extra.uid === null ? '' : String(extra.uid);
  const key = safeKey(uid) || safeKey(raw.id);
  if (!key) {
    return null;
  }
  const renting = flag(extra.renting);
  const returning = flag(extra.returning);
  const online = flag(extra.online);
  const ebikes = count(extra.ebikes);
  return {
    key,
    id: String(raw.id ?? ''),
    uid,
    name: String(raw.name ?? '').trim() || uid || String(raw.id),
    address: typeof extra.address === 'string' ? extra.address.trim() : '',
    latitude: coordinate(raw.latitude),
    longitude: coordinate(raw.longitude),
    bikes: count(raw.free_bikes) ?? 0,
    // `has_ebikes: false` with no count: the station takes no e-bike.
    ebikes: ebikes ?? (extra.has_ebikes === true ? 0 : null),
    mechanical: count(extra.normal_bikes),
    docks: count(raw.empty_slots),
    slots: count(extra.slots),
    open: online !== false && renting !== false,
    renting: renting !== false && online !== false,
    returning: returning !== false && online !== false,
    updatedAt: readTime(raw.timestamp),
  };
}

/**
 * @description A raw network, as the integration keeps it.
 * @param {object} raw - The network of the API.
 * @returns {object|null} `{ id, name, city, country, latitude, longitude,
 * company }`.
 */
function parseNetwork(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string') {
    return null;
  }
  const location = raw.location ?? {};
  const company = Array.isArray(raw.company) ? raw.company : raw.company ? [raw.company] : [];
  return {
    id: raw.id,
    name: String(raw.name ?? raw.id).trim(),
    city: String(location.city ?? '').trim(),
    country: String(location.country ?? '')
      .trim()
      .toUpperCase(),
    latitude: coordinate(location.latitude),
    longitude: coordinate(location.longitude),
    company: company.map(String).join(', '),
  };
}

/**
 * @description Find networks by their id, name, city or company.
 * @param {object[]} networks - The networks (parseNetwork).
 * @param {string} query - "Paris", "velib", "nextbike".
 * @returns {object[]} The matches, exact id first.
 */
function searchNetworks(networks, query) {
  const words = fold(query).split(' ').filter(Boolean);
  if (words.length === 0) {
    return [];
  }
  const wanted = fold(query);
  return networks
    .map((network) => {
      const text = fold(`${network.id} ${network.name} ${network.city} ${network.company}`);
      if (!words.every((word) => text.includes(word))) {
        return null;
      }
      const rank =
        network.id === wanted
          ? 0
          : fold(network.name) === wanted
            ? 1
            : fold(network.city) === wanted
              ? 2
              : 3;
      return { network, rank };
    })
    .filter(Boolean)
    .sort((a, b) => a.rank - b.rank || a.network.name.localeCompare(b.network.name))
    .map(({ network }) => network);
}

/**
 * @description The network a typed value stands for: its id, else a unique
 * name or city.
 * @param {object[]} networks - The networks.
 * @param {string} typed - "velib", "Vélib' Métropole", "Lyon".
 * @returns {object|null} The network.
 */
function resolveNetwork(networks, typed) {
  const wanted = fold(typed);
  if (!wanted) {
    return null;
  }
  const byId = networks.find((network) => network.id === wanted);
  if (byId) {
    return byId;
  }
  for (const field of ['name', 'city']) {
    const found = networks.filter((network) => fold(network[field]) === wanted);
    if (found.length === 1) {
      return found[0];
    }
  }
  const matches = searchNetworks(networks, typed);
  return matches.length === 1 ? matches[0] : null;
}

/**
 * @description The networks nearest to a point.
 * @param {object[]} networks - The networks.
 * @param {{ latitude: number, longitude: number }} point - The point.
 * @param {number} [max] - How many.
 * @returns {Array<object>} The networks with their `distance` in metres.
 */
function nearestNetworks(networks, point, max = 5) {
  return networks
    .filter((network) => network.latitude !== null && network.longitude !== null)
    .map((network) => ({ ...network, distance: distance(point, network) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, max);
}

/**
 * @description The stations nearest to a point.
 * @param {object[]} stations - The stations (parseStation).
 * @param {{ latitude: number, longitude: number }} point - The point.
 * @param {number} [max] - How many.
 * @param {Function} [keep] - Which stations count (`(station) => boolean`).
 * @returns {Array<object>} The stations with their `distance` in metres.
 */
function nearestStations(stations, point, max = 5, keep = () => true) {
  return stations
    .filter((station) => station.latitude !== null && station.longitude !== null && keep(station))
    .map((station) => ({ ...station, distance: distance(point, station) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, max);
}

/**
 * @description Find stations by their key, id or name.
 * @param {object[]} stations - The stations of a network.
 * @param {string} query - "22002", "Argenson - Château", "argenson".
 * @returns {object[]} The matches: an exact key or name alone, else every
 * station whose name and address hold all the words.
 */
function searchStations(stations, query) {
  const wanted = fold(query);
  if (!wanted) {
    return [];
  }
  const key = safeKey(query);
  const exact = stations.filter(
    (station) => station.key === key || station.uid === query.trim() || station.id === query.trim(),
  );
  if (exact.length > 0) {
    return exact;
  }
  const named = stations.filter((station) => fold(station.name) === wanted);
  if (named.length > 0) {
    return named;
  }
  const words = wanted.split(' ').filter(Boolean);
  return stations.filter((station) => {
    const text = fold(`${station.name} ${station.address}`);
    return words.every((word) => text.includes(word));
  });
}

export {
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
};
