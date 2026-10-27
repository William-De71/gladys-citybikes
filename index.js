// -----------------------------------------------------------------------------
// Entry point of the CityBikes external integration.
//
// Brings the bike sharing stations of the CityBikes API (https://citybik.es)
// into Gladys, for 815 networks in the world (Vélib', Vélo'v, V3, Bicing,
// nextbike…), with no key:
//   - devices: one per followed station, with its bikes, e-bikes,
//     mechanical bikes and free docks (src/device.js);
//   - scene triggers: bikes or e-bikes available again, station empty, no
//     e-bike left, free docks again, station full;
//   - scene actions: read a station, find the nearest station with a bike,
//     an e-bike or a free dock;
//   - dashboard widgets: stations, nearby.
//
// This file only wires the SDK client: the handlers are in src/app.js.
//
// Environment variables provided by the Gladys supervisor:
//   GLADYS_HOST_API_URL / GLADYS_INTEGRATION_TOKEN / GLADYS_INTEGRATION_SELECTOR
// The SDK reads them automatically: `new GladysIntegration()` is enough.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import { createApp } from './src/app.js';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

const gladys = new GladysIntegration();
createApp(gladys);

// --- Startup -----------------------------------------------------------------------
logger.info(`Starting the CityBikes integration ${version}...`);
gladys.connect().catch((err) => {
  logger.error('Initial connection failed', err);
  process.exit(1);
});
