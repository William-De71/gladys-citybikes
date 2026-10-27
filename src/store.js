// -----------------------------------------------------------------------------
// What the integration keeps across restarts, in /data/citybikes.json (the only
// writable place of the container):
//   - `networks`   the networks of CityBikes (read again weekly), so a restart
//                  reads nothing but the followed network;
//   - `seen`       what the scene triggers already know: per followed station
//                  (`<network>:<station key>`), its bikes, e-bikes and free
//                  docks at the last reading. A restart never fires the same
//                  event twice.
// -----------------------------------------------------------------------------

import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const DEFAULT_PATH = '/data/citybikes.json';
const EMPTY = () => ({ networks: { list: null, at: 0 }, seen: {} });

/**
 * @description The store.
 * @param {object} [options] - `{ path, logger }`.
 * @returns {object} `{ data, load, save }`.
 */
function createStore({ path = DEFAULT_PATH, logger } = {}) {
  const store = {
    data: EMPTY(),
    /**
     * @description Read the file; an absent or broken file is an empty store.
     * @returns {Promise<void>}
     */
    async load() {
      try {
        const raw = JSON.parse(await readFile(path, 'utf8'));
        const base = EMPTY();
        const value = raw && typeof raw === 'object' ? raw : {};
        const part = (name) => (value[name] && typeof value[name] === 'object' ? value[name] : {});
        store.data = {
          networks: { ...base.networks, ...part('networks') },
          seen: part('seen'),
        };
      } catch (err) {
        if (err.code !== 'ENOENT') {
          logger?.warn(`Unable to read ${path}: ${err.message}`);
        }
        store.data = EMPTY();
      }
    },
    /**
     * @description Write the file (atomically: a temporary file, then a rename).
     * @returns {Promise<void>}
     */
    async save() {
      try {
        await mkdir(dirname(path), { recursive: true });
        const temporary = `${path}.tmp`;
        await writeFile(temporary, JSON.stringify(store.data));
        await rename(temporary, path);
      } catch (err) {
        logger?.warn(`Unable to write ${path}: ${err.message}`);
      }
    },
  };
  return store;
}

export { DEFAULT_PATH, createStore };
