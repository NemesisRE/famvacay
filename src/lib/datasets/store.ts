/**
 * Live reference datasets (airports, flight routes, climate normals, ...).
 *
 * The JSON bundled in the repo is only the seed: on the server, the background refresh
 * (refresh-service.ts) publishes newer versions here. Pure and dependency-free so it can be
 * imported from client bundles too - in the browser nothing is ever published and every
 * consumer keeps using its bundled import.
 *
 * State lives on globalThis: Next.js may load instrumentation and route handlers as separate
 * bundles with separate copies of this module, and all of them must see the same data.
 *
 * Consumers keep their own bundled import (so a client bundle only contains the datasets it
 * actually uses) and pass it as the fallback; derived indexes are rebuilt lazily by comparing
 * `getDatasetGeneration()` with the generation they were built at.
 */

export type DatasetName =
  | 'airports'
  | 'airport-traffic'
  | 'city-names'
  | 'flight-routes'
  | 'climate-normals'
  | 'holiday-appeal'
  | 'destination-names';

interface PublishedDataset {
  data: unknown;
  version: number;
}

interface DatasetStoreState {
  published: Partial<Record<DatasetName, PublishedDataset>>;
  /** Incremented on every publish; derived caches compare against it. */
  generation: number;
}

const GLOBAL_KEY = '__famvacayDatasetStore';

function state(): DatasetStoreState {
  const g = globalThis as unknown as Record<string, DatasetStoreState | undefined>;
  return (g[GLOBAL_KEY] ??= { published: {}, generation: 0 });
}

/** The live version of a dataset, or the bundled seed until one has been published. */
export function getDataset<T>(name: DatasetName, bundled: T): T {
  const live = state().published[name];
  return live ? (live.data as T) : bundled;
}

/** 0 = bundled seed. */
export function getDatasetVersion(name: DatasetName): number {
  return state().published[name]?.version ?? 0;
}

export function getDatasetGeneration(): number {
  return state().generation;
}

/** Tests only: drop all published datasets (globalThis outlives a single test file). */
export function resetDatasetStoreForTests(): void {
  const s = state();
  s.published = {};
  s.generation++;
}

/** Server-side: make a refreshed dataset live in this process. Older versions are ignored. */
export function publishDataset(name: DatasetName, data: unknown, version: number): boolean {
  const s = state();
  if ((s.published[name]?.version ?? 0) >= version) return false;
  s.published[name] = { data, version };
  s.generation++;
  return true;
}

/**
 * Memoize a value derived from datasets: recomputed after any dataset is published.
 * Usage: const getIndex = derived(() => buildIndex(getDataset('airports', bundled)));
 */
export function derived<T>(compute: () => T): () => T {
  let builtAt = -1;
  let value: T;
  return () => {
    const generation = getDatasetGeneration();
    if (generation !== builtAt) {
      value = compute();
      builtAt = generation;
    }
    return value;
  };
}

/** A Map cache that empties itself whenever a dataset is published. */
export function datasetScopedCache<K, V>(): () => Map<K, V> {
  return derived(() => new Map<K, V>());
}
