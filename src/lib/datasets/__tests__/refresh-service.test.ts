import { afterEach, describe, expect, it } from 'vitest';
import { createDatasetRefreshService, type DatasetDb } from '../refresh-service';
import { getDataset, getDatasetVersion, publishDataset, resetDatasetStoreForTests } from '../store';
import type { DatasetDefinition } from '../definitions';
import { getAirportByIata, getAllCommercialAirports } from '@/lib/airports/airport-service';
import { resolveFlightRoute } from '@/lib/airports/flight-routes';

/** In-memory stand-in for prisma.generatedDataset (only the operations the service uses). */
function fakeDb() {
  const rows = new Map<string, any>();
  const matches = (row: any, where: any): boolean =>
    Object.entries(where).every(([k, v]: [string, any]) => {
      if (k === 'OR') return v.some((w: any) => matches(row, w));
      if (v && typeof v === 'object' && 'lt' in v) return row[k] != null && row[k] < v.lt;
      return (row[k] ?? null) === v;
    });
  const db: DatasetDb & { rows: Map<string, any> } = {
    rows,
    generatedDataset: {
      findMany: async () => [...rows.values()].map((r) => ({ name: r.name, version: r.version })),
      findUnique: async ({ where }) => (rows.has(where.name) ? { ...rows.get(where.name) } : null),
      upsert: async ({ where, create }) => {
        if (!rows.has(where.name)) rows.set(where.name, { version: 0, leaseOwner: null, leaseUntil: null, ...create });
        return rows.get(where.name);
      },
      update: async ({ where, data }) => Object.assign(rows.get(where.name), data),
      updateMany: async ({ where, data }) => {
        let count = 0;
        for (const row of rows.values()) {
          if (matches(row, where)) {
            Object.assign(row, data);
            count++;
          }
        }
        return { count };
      },
    },
  };
  return db;
}

const seedRoutes = { FRA: 'PMI', PMI: 'FRA' };
const routesDefinition = (output: () => unknown, extra: Partial<DatasetDefinition> = {}): DatasetDefinition => ({
  name: 'flight-routes',
  seed: seedRoutes,
  refreshIntervalMs: 1_000,
  run: async () => ({ data: output() }),
  validate: (data, current) =>
    Object.keys(data as object).length < Object.keys(current as object).length ? 'shrank' : null,
  ...extra,
});

const service = (db: DatasetDb, definitions: DatasetDefinition[], instanceId = 'replica-a') =>
  createDatasetRefreshService({ db, definitions, instanceId, log: () => {} });

afterEach(() => resetDatasetStoreForTests());

describe('dataset refresh service', () => {
  it('publishes a refreshed dataset to the database and this process', async () => {
    const db = fakeDb();
    const next = { FRA: 'PMI JFK', PMI: 'FRA', JFK: 'FRA' };
    expect(await service(db, [routesDefinition(() => next)]).refreshIfDue(routesDefinition(() => next))).toBe('published');
    expect(getDatasetVersion('flight-routes')).toBe(1);
    expect(getDataset('flight-routes', seedRoutes)).toEqual(next);
    const row = db.rows.get('flight-routes');
    expect(row.version).toBe(1);
    expect(row.payload).toBeInstanceOf(Buffer);
    expect(row.leaseOwner).toBeNull();
    expect(row.nextDueAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('lets another replica pick up the published version', async () => {
    const db = fakeDb();
    const def = routesDefinition(() => ({ FRA: 'PMI JFK', PMI: 'FRA', JFK: 'FRA' }));
    await service(db, [def]).refreshIfDue(def);
    resetDatasetStoreForTests(); // a fresh process on another replica
    expect(getDatasetVersion('flight-routes')).toBe(0);
    expect(await service(db, [def], 'replica-b').loadPublished()).toEqual(['flight-routes']);
    expect(getDataset('flight-routes', seedRoutes)).toHaveProperty('JFK');
  });

  it('rejects data that fails the sanity check (e.g. an upstream source going empty)', async () => {
    const db = fakeDb();
    const def = routesDefinition(() => ({ FRA: 'PMI' }));
    expect(await service(db, [def]).refreshIfDue(def)).toBe('rejected');
    expect(getDatasetVersion('flight-routes')).toBe(0);
    expect(db.rows.get('flight-routes').lastError).toContain('shrank');
    expect(db.rows.get('flight-routes').payload).toBeUndefined();
  });

  it('does not create a new version when nothing changed', async () => {
    const db = fakeDb();
    const data = { FRA: 'PMI JFK', PMI: 'FRA', JFK: 'FRA' };
    const def = routesDefinition(() => data, { refreshIntervalMs: 0 });
    await service(db, [def]).refreshIfDue(def);
    db.rows.get('flight-routes').nextDueAt = null;
    expect(await service(db, [def]).refreshIfDue(def)).toBe('unchanged');
    expect(db.rows.get('flight-routes').version).toBe(1);
  });

  it('skips datasets that are not due, and those another replica is refreshing', async () => {
    const db = fakeDb();
    const def = routesDefinition(() => ({ FRA: 'PMI JFK', PMI: 'FRA', JFK: 'FRA' }));
    db.rows.set('flight-routes', { name: 'flight-routes', version: 0, nextDueAt: new Date(Date.now() + 60_000) });
    expect(await service(db, [def]).refreshIfDue(def)).toBe('not-due');

    db.rows.set('flight-routes', { name: 'flight-routes', version: 0, leaseOwner: 'replica-b', leaseUntil: new Date(Date.now() + 60_000) });
    expect(await service(db, [def]).refreshIfDue(def)).toBe('busy');
  });

  it('records failures and retries later instead of crashing', async () => {
    const db = fakeDb();
    const def = routesDefinition(() => {
      throw new Error('upstream down');
    });
    expect(await service(db, [def]).refreshIfDue(def)).toBe('failed');
    const row = db.rows.get('flight-routes');
    expect(row.lastError).toBe('upstream down');
    expect(row.leaseOwner).toBeNull();
    expect(row.nextDueAt.getTime()).toBeGreaterThan(Date.now());
  });
});

describe('consumers follow published datasets', () => {
  it('rebuilds the airport index and drops cached routes when new data lands', () => {
    expect(getAirportByIata('ZZZ')).toBeUndefined();
    const before = resolveFlightRoute('FRA', 'PMI');
    const airports = [
      ...(getAllCommercialAirports() as any[]),
      { code: 'ZZZ', icao: '', name: 'Test Field', city: 'Testville', country: 'Germany', state: 'DE-BW', lat: 48, lon: 9, altitude: 0, type: 'medium_airport', isMajorHub: false, isHighSpeedRailConnected: false },
    ];
    publishDataset('airports', airports, 1);
    expect(getAirportByIata('ZZZ')?.city).toBe('Testville');
    // The route cache was emptied: a fresh object is computed instead of the cached one
    const after = resolveFlightRoute('FRA', 'PMI');
    expect(after).not.toBe(before);
    expect({ stops: after.stops, km: after.flightDistanceKm }).toEqual({ stops: before.stops, km: before.flightDistanceKm });
  });
});
