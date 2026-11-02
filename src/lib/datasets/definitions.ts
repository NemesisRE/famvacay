import airportsSeed from '@/lib/airports/data/airports.json';
import airportTrafficSeed from '@/lib/airports/data/airport-traffic.json';
import cityNamesSeed from '@/lib/airports/data/city-names.json';
import flightRoutesSeed from '@/lib/airports/data/flight-routes.json';
import climateNormalsSeed from '@/lib/optimizer/data/climate-normals.json';
import holidayAppealSeed from '@/lib/optimizer/data/holiday-appeal.json';
import destinationNamesSeed from '@/lib/geo/data/destination-names.json';
import priceLevelsSeed from '@/lib/pricing/data/price-levels.json';
import { resolveOpenMeteoAccess } from '@/lib/integrations/open-meteo-access';
import { getDataset, type DatasetName } from './store';
import type { AirportRecord, GeneratorContext } from './generators/common';
import { generateAirports } from './generators/airports';
import { generateFlightRoutes } from './generators/flight-routes';
import { generateAirportTraffic } from './generators/airport-traffic';
import { generateCityNames } from './generators/city-names';
import { generateClimateNormals, type ClimateGeneratorState } from './generators/climate-normals';
import { generateHolidayData, HOLIDAY_APPEAL_ROW_LENGTH, type HolidayData } from './generators/holiday-appeal';
import { generatePriceLevels } from './generators/price-levels';
import { generateTourismSpend } from './generators/tourism-spend';
import tourismSpendSeed from '@/lib/pricing/data/tourism-spend.json';

/**
 * The refreshable reference datasets, in dependency order (routes, traffic, names, holiday appeal and climate
 * are derived from the airport list; climate also from the route network).
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export interface DatasetRunContext extends GeneratorContext {
  /** Resumable generator progress persisted between runs (null on the first run). */
  loadState: () => Promise<unknown | null>;
  saveState: (state: unknown) => Promise<void>;
}

export interface DatasetRunResult {
  data: unknown;
  /** More work pending (e.g. a daily API budget ran out): retry soon instead of at the interval. */
  incomplete?: boolean;
}

export interface DatasetDefinition {
  name: DatasetName;
  seed: unknown;
  refreshIntervalMs: number;
  /** Retry interval while a run reports `incomplete`. */
  incompleteRetryMs?: number;
  run: (ctx: DatasetRunContext) => Promise<DatasetRunResult>;
  /**
   * Sanity check before publishing - the replacement for the human review the weekly CI pull
   * request used to get. Returns an error message, or null when the data may be published.
   */
  validate: (data: unknown, current: unknown) => string | null;
}

export const current = <T>(name: DatasetName, seed: unknown) => getDataset(name, seed) as T;

function sizeOf(data: unknown): number {
  if (Array.isArray(data)) return data.length;
  if (data && typeof data === 'object') return Object.keys(data).length;
  return 0;
}

/** Guards against an upstream source going (partly) empty: at least `min` entries and `ratio` of today's. */
function notShrunk(data: unknown, currentData: unknown, min: number, ratio: number): string | null {
  const size = sizeOf(data);
  const before = sizeOf(currentData);
  if (size < min) return `only ${size} entries (minimum ${min})`;
  if (size < before * ratio) return `shrank from ${before} to ${size} entries (more than ${Math.round((1 - ratio) * 100)}%)`;
  return null;
}

function everyValue(data: unknown, check: (value: unknown, key: string) => boolean): boolean {
  return Boolean(data) && typeof data === 'object' && Object.entries(data as object).every(([k, v]) => check(v, k));
}

const airports = () => current<AirportRecord[]>('airports', airportsSeed);
const holidayDataOptions = () => ({
  traffic: current<Record<string, number>>('airport-traffic', airportTrafficSeed),
  routes: current<Record<string, string>>('flight-routes', flightRoutesSeed),
});

// The holiday-appeal run also yields the destination names; the names dataset (next in order)
// publishes them instead of reading every guide a second time
let lastHolidayData: HolidayData | null = null;

export const DATASET_DEFINITIONS: DatasetDefinition[] = [
  {
    name: 'airports',
    seed: airportsSeed,
    refreshIntervalMs: 30 * DAY_MS,
    run: async (ctx) => ({ data: await generateAirports(ctx) }),
    validate: (data, before) => {
      if (!Array.isArray(data)) return 'not an array';
      const bad = data.find(
        (a: AirportRecord) => !/^[A-Z]{3}$/.test(a?.code) || !Number.isFinite(a?.lat) || !Number.isFinite(a?.lon)
      );
      if (bad) return `invalid airport record ${JSON.stringify(bad).slice(0, 120)}`;
      return notShrunk(data, before, 1_000, 0.9);
    },
  },
  {
    name: 'flight-routes',
    seed: flightRoutesSeed,
    refreshIntervalMs: 30 * DAY_MS,
    run: async (ctx) => ({ data: await generateFlightRoutes(ctx, airports()) }),
    validate: (data, before) =>
      everyValue(data, (v, k) => /^[A-Z]{3}$/.test(k) && typeof v === 'string')
        ? notShrunk(data, before, 1_000, 0.9)
        : 'invalid route adjacency list',
  },
  {
    name: 'airport-traffic',
    seed: airportTrafficSeed,
    refreshIntervalMs: 30 * DAY_MS,
    run: async (ctx) => ({ data: await generateAirportTraffic(ctx, airports()) }),
    validate: (data, before) =>
      everyValue(data, (v) => typeof v === 'number' && v > 0) ? notShrunk(data, before, 200, 0.8) : 'invalid traffic figures',
  },
  {
    name: 'city-names',
    seed: cityNamesSeed,
    refreshIntervalMs: 30 * DAY_MS,
    run: async (ctx) => ({ data: await generateCityNames(ctx, airports()) }),
    validate: (data, before) =>
      everyValue(data, (v) => Boolean(v) && typeof v === 'object') ? notShrunk(data, before, 200, 0.8) : 'invalid city names',
  },
  {
    name: 'holiday-appeal',
    seed: holidayAppealSeed,
    // Travel guides and their readership change slowly; one run takes a few minutes
    refreshIntervalMs: 30 * DAY_MS,
    run: async (ctx) => {
      lastHolidayData = await generateHolidayData(ctx, airports(), holidayDataOptions());
      return { data: lastHolidayData.appeal };
    },
    validate: (data, before) =>
      everyValue(
        data,
        (v, k) =>
          /^[A-Z]{3}$/.test(k) &&
          Array.isArray(v) &&
          v.length === HOLIDAY_APPEAL_ROW_LENGTH &&
          v.every((n) => Number.isFinite(n) && n >= 0)
      )
        ? notShrunk(data, before, 500, 0.8)
        : 'invalid holiday appeal rows',
  },
  {
    name: 'destination-names',
    seed: destinationNamesSeed,
    refreshIntervalMs: 30 * DAY_MS,
    run: async (ctx) => {
      const data = lastHolidayData ?? (await generateHolidayData(ctx, airports(), holidayDataOptions()));
      lastHolidayData = null;
      return { data: data.names };
    },
    validate: (data, before) =>
      everyValue(
        data,
        (v, k) =>
          /^[A-Z]{3}$/.test(k) &&
          Boolean(v) &&
          typeof v === 'object' &&
          typeof (v as { n?: unknown }).n === 'object' &&
          Object.values((v as { n: Record<string, unknown> }).n).every((name) => typeof name === 'string' && name.length > 0)
      )
        ? notShrunk(data, before, 0, 0.7)
        : 'invalid destination names',
  },
  {
    // Country price levels (World Bank), independent of the airport list
    name: 'price-levels',
    seed: priceLevelsSeed,
    refreshIntervalMs: 90 * DAY_MS,
    run: async (ctx) => ({ data: await generatePriceLevels(ctx) }),
    validate: (data, before) =>
      everyValue(data, (v, k) => /^[A-Z]{2}$/.test(k) && typeof v === 'number' && v >= 0.05 && v <= 5)
        ? notShrunk(data, before, 150, 0.8)
        : 'invalid price levels',
  },
  {
    // Tourist spend per arrival (World Bank): where holidays cost more than the national price level
    name: 'tourism-spend',
    seed: tourismSpendSeed,
    refreshIntervalMs: 90 * DAY_MS,
    run: async (ctx) => ({ data: await generateTourismSpend(ctx) }),
    validate: (data, before) =>
      everyValue(data, (v, k) => /^[A-Z]{2}$/.test(k) && typeof v === 'number' && v >= 50 && v <= 20000)
        // The bundled seed is filled by the data-sync workflow; until then an empty start is valid
        ? notShrunk(data, before, sizeOf(before) === 0 ? 0 : 80, 0.8)
        : 'invalid tourism spend',
  },
  {
    name: 'climate-normals',
    seed: climateNormalsSeed,
    // Climatology barely changes; the hourly retry lets rain-duration data fill in within the
    // Open-Meteo free tier's per-hour and per-day limits.
    refreshIntervalMs: 90 * DAY_MS,
    incompleteRetryMs: 60 * 60 * 1000,
    run: async (ctx) => {
      const saved = (await ctx.loadState()) as ClimateGeneratorState | null;
      const result = await generateClimateNormals({
        airports: airports(),
        flightRoutes: current<Record<string, string>>('flight-routes', flightRoutesSeed),
        previousData: current<Record<string, number[]>>('climate-normals', climateNormalsSeed),
        state: saved ?? { nasa: {}, rain: {} },
        saveState: (state) => ctx.saveState(state),
        openMeteo: resolveOpenMeteoAccess(),
        fetchImpl: ctx.fetch,
        sleep: ctx.sleep,
        log: ctx.log,
      });
      return { data: result.data, incomplete: !result.complete };
    },
    validate: (data, before) =>
      everyValue(data, (v) => Array.isArray(v) && (v.length === 36 || v.length === 60))
        ? notShrunk(data, before, 1_000, 0.9)
        : 'invalid climate rows',
  },
];
