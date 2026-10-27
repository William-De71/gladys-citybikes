# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions
follow [Semantic Versioning](https://semver.org/). This file is generated at
each release from the Conventional Commits: do not edit it by hand.

## [0.1.0] - 2026-10-27

### Added

- Bike sharing stations of the CityBikes API, for more than 800 networks in the world (Vélib', Vélo'v, V3, V'Lille, Bicing, nextbike…): the network typed by id, name or city, or the one nearest to the house.
- One device per followed station (up to 20 typed by id or name, plus the 1 to 5 nearest to the house): available bikes, e-bikes, mechanical bikes and free docks, each when the operator gives it.
- Scene triggers: bikes available again, station empty, e-bikes available again, no e-bike left, free docks again, station full.
- Scene actions: read a station, and find the nearest station with a bike, an e-bike or a free dock (from the house or from a followed station), each with a ready-made sentence.
- Dashboard widgets: the followed stations (tiles for one, a row each for several) and the stations nearest to the house, optionally only those with a bike, an e-bike or a free dock.
- Configuration actions: test the connection, find a network, find a station, and a diagnostic written to the Logs tab.
- Cloud transport: one request per reading of the network (every 1 to 10 minutes, 2 by default), within the 300 requests per hour of the API; the list of the networks kept in /data; the house coordinates never leave Gladys and the integration.
- English, French, German and Spanish everywhere: settings, devices, widgets, scenes and documentation.

[0.1.0]: https://github.com/William-De71/gladys-citybikes/releases/tag/v0.1.0
