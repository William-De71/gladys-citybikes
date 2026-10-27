# CLAUDE.md

Project rules for coding assistants (Claude Code reads this file) and for human
contributors.

## What this is

A Gladys Assistant **external integration** for the bike sharing stations of
the CityBikes API: a Node.js service (Node 22+, ESM, no build step) that runs
in its own sandboxed Docker container and talks to Gladys through
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js),
its only runtime dependency. It reads the free CityBikes API
(`https://api.citybik.es/v2`, no key, 300 requests per hour and per address):
the list of the networks (815, kept in /data, read weekly) and, at each
reading, the whole followed network with its stations — bikes, e-bikes,
mechanical bikes, free docks. The network is typed (id, name or city) or the
one nearest to the house; the stations are typed (up to 20, id or name) and/or
the 1 to 5 nearest to the house (`location` permission).
Transport: cloud only.
Documentation of the API: https://api.citybik.es/v2/ (terms of service at the
bottom: credit CityBikes with a link).

## Commands

```bash
npm install
npm test                                  # node --test, the built-in runner
node --test test/widgets.test.js          # one file
DEBUG=gladys-integration-sdk npm test     # with the SDK debug logs
npm run lint                              # ESLint
npm run format:check                      # Prettier, as the CI runs it
npm run format                            # Prettier, fix in place
npx github:GladysAssistant/integration-store . --skip-image-check   # store checks
scripts/build-cover.sh                    # cover.jpg from docs/assets/cover.svg
docs/illustrations/render.sh              # docs/assets/widgets.<lang>.png
node .github/scripts/release.mjs next     # the version the next release would get
```

## Architecture

```
index.js                SDK wiring only (new GladysIntegration + createApp)
src/app.js              every handler, registered before connect(); the timer, the house, the network
src/citybikes-api.js    HTTP client of the API: networks, one network, quota headers, 429 back-off
src/stations.js         raw stations / networks -> kept fields, search, distances, nearest
src/device.js           the station devices and their states
src/events.js           scene trigger transitions, payloads, scene action outputs
src/widgets.js          stations and nearby dashboard widgets
src/store.js            /data/citybikes.json: networks, `seen`
src/config.js           configuration (network, house, stations, nearby, interval, language)
src/i18n.js             runtime texts, en / fr / de / es
gladys-assistant-integration.json   manifest
docs/{en,fr,de,es}.md   user documentation, re-hosted by the store
docs/illustrations/     generated widget images (render.sh, gen.mjs, render.js)
test/fixtures/          real answers of the CityBikes API, reduced
.github/scripts/release.mjs         version, changelog, bump (tested in test/)
```

## Rules

- **External ids are forever**, and so is every key users store: device and
  feature external ids (`station:<network id>_<station key>`, the key being
  the operator's id `extra.uid`, else the id of CityBikes — never the name,
  and never prefer the CityBikes id over the uid: PyBikes may hash it from the
  coordinates), feature `category` / `type` / `unit` / `min` / `max` /
  `step`, the keys of `config_schema`, `actions`, the widgets and their
  settings, scene triggers (fields, variables) and scene actions (fields,
  options, outputs), and the internal config key `last_language`.
  `test/structure.test.js` compares them to
  `test/fixtures/discovery.baseline.json`: never update the baseline to make a
  test pass without a documented migration.
- **Category / type pairs.** Every count is `counter-sensor` / `integer`,
  0-999. A feature exists only when the operator gives the count (`ebikes`,
  `mechanical`, `docks` may be null): never publish a fake 0.
- **`should_poll` stays false**: the integration reads the network on its own
  timer (`interval`, 1 to 10 min, 2 by default), never on a Gladys poll. A
  widget or a scene action reuses a reading of less than 90 s.
- **Quota of the API.** 300 requests per hour and per address
  (`x-ratelimit-remaining-hour`, `ratelimit-reset`), 429 beyond: the client
  then sends nothing before the reset. One request per reading whatever the
  number of stations; the list of the networks weekly. Never add a request per
  station.
- **The house stays here.** Its coordinates (`getHouses()`) are only used to
  compute distances inside the container: never send them to the API, never
  log them (the diagnostic gives the house name only).
- **Events once.** `seen` (in /data) remembers the counts of each followed
  station at the last reading. The first reading of a station is a baseline:
  nothing fires. Events fire only for the stations the user created. A
  closed station counts as no bike and no dock. A scene action or a widget
  never fires an event.
- **Credit.** The terms of CityBikes ask to say the data come from it and to
  link to it: keep "CityBikes (citybik.es)" and the time of the reading in
  every widget, and the credit in the README, the docs and NOTICE.
- **The container rootfs is read-only.** Write only under `/data`.
- **Four languages.** Every user-facing text (manifest, runtime messages in
  `src/i18n.js`, `docs/*.md`, README) exists in English, French, German and
  Spanish. `test/i18n.test.js` checks it. Names of networks and stations stay
  as the operators write them.
- **Widget images.** After any change to the content of a widget, run
  `docs/illustrations/render.sh` again and look at the four PNG files.
- **Versions belong to the Release workflow**: never edit `version` in
  `package.json`, the lockfile or the manifest, nor the `docker_image` tag.
  The version stays below 1.0.0 until the maintainer runs the Release workflow
  with `release-as: 1.0.0`.
- **Changelog.** Never edit CHANGELOG.md by hand, it is generated at the
  release. Write the PR title as the line the user will read.
- **Commits and PR titles** follow Conventional Commits, in English: `feat` ->
  minor, `fix` / `perf` -> patch, `!` or `BREAKING CHANGE:` -> major (minor
  below 1.0.0); `docs`, `chore`, `ci`, `test`, `style`, `refactor`, `build`
  release nothing.
- **Manifest.** Texts are objects `{ "en", "fr", "de", "es" }`; the catalog
  `description` holds 10 to 100 characters per language; the file stays under
  100 KB. `gladys_version` is `>=5.3.0` (widgets, scene triggers, catalog
  `keywords`, the `houses` source of 5.2.0). Transport: `["cloud"]`.
  Permission: `location` only. No secret, no `countries` (worldwide).
- **Forum drafts** (`.github/forum-*.md`) are never committed.
- **Style.** Prettier formats, ESLint catches mistakes. Comments explain why,
  in English. Tests never touch the network (the fake API of
  `test/helpers/fixtures.js`).
