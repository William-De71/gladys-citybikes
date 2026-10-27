// Builds the widget contents of the illustrations with the integration's own
// code: node gen.mjs <repo> <out.json> (run by render.sh)
//
// The two widgets on a real Tuesday evening in Paris: the answer of the
// CityBikes API for Vélib' Métropole read on 2026-10-27 around 23:00 and kept
// in test/fixtures goes through the real parser (src/stations.js) and the real
// widget builders (src/widgets.js), from a house near the Arc de Triomphe.
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const [repo, out] = process.argv.slice(2);
const load = (path) => import(pathToFileURL(`${repo}/${path}`).href);
const { buildStationsWidget, buildNearbyWidget } = await load('src/widgets.js');
const { parseStation, nearestStations } = await load('src/stations.js');
const { LANGUAGES } = await load('src/i18n.js');
const fixture = (name) => JSON.parse(readFileSync(`${repo}/test/fixtures/${name}`, 'utf8'));
const manifest = JSON.parse(readFileSync(`${repo}/gladys-assistant-integration.json`, 'utf8'));

// Tuesday 27 October 2026, 23:00 in Paris.
const NOW = Date.parse('2026-10-27T22:00:00Z');
const TZ = 'Europe/Paris';
const HOUSE = { latitude: 48.8738, longitude: 2.295 };

const raw = fixture('velib.json').network;
const stations = raw.stations.map(parseStation);
const network = { id: raw.id, name: raw.name };
const followed = ['22002', '8026', '8057', '17033'].map((uid) =>
  stations.find((station) => station.uid === uid),
);

const contents = {};
for (const language of LANGUAGES) {
  contents[language] = {
    stations: buildStationsWidget({
      stations: followed.map((station) => ({ name: station.name, station })),
      readAt: NOW,
      language,
      timeZone: TZ,
    }),
    'stations-one': buildStationsWidget({
      stations: [{ name: followed[0].name, station: followed[0] }],
      readAt: NOW,
      language,
      timeZone: TZ,
    }),
    nearby: buildNearbyWidget({
      stations: nearestStations(stations, HOUSE, 5),
      network,
      readAt: NOW,
      show: 'all',
      language,
      timeZone: TZ,
    }),
  };
}
const widgets = Object.fromEntries(
  manifest.widgets.map((w) => [w.key, { icon: w.icon, label: w.label }]),
);
widgets['stations-one'] = widgets.stations;
writeFileSync(out, JSON.stringify({ now: NOW, widgets, contents }));
