import { SURFACE_DESTINATIONS } from '@/lib/geo/surface-destinations';
import type { AirportRecord } from './common';
import {
  type OpenMeteoAccess,
  openMeteoCallCost,
  withOpenMeteoKey,
} from '@/lib/integrations/open-meteo-access';

/**
 * Builds the climate-normals dataset: per destination, 12 months of
 *   [mean °C, mean daily range °C, precipitation mm/day]          (NASA POWER climatology)
 * and, where available,
 *   [rainy days/month, rain hours per rainy day]                  (Open-Meteo archive)
 * flattened to 36 or 60 numbers. Rain duration is what separates a one-hour tropical afternoon
 * storm from a day of steady rain, which the precipitation total alone cannot.
 *
 * Both sources are fetched per grid cell (destinations sharing a ~0.5° x 0.625° cell share one
 * request). Fetched cells are kept in a resumable state object, so a run that hits the
 * Open-Meteo free-tier daily budget simply continues on the next run.
 */

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const LAPSE_RATE = 0.0055; // °C per metre (between the standard 0.0065 and coastal/moist conditions)
/**
 * Thresholds that cancel the reanalysis "drizzle bias": models rain lightly for many hours,
 * which made Bali's dry season and Mauritius look like year-round monsoon at the usual 1 mm /
 * 0.1 mm/h cutoffs. A rainy day needs 2.5 mm; a rain hour needs 0.5 mm/h (noticeable rain).
 * Checked against known climates: Bangkok Aug ~20 days/~3.5 h (afternoon storms), Bali Jan
 * ~22 days/~5 h (wet season) vs. Bali Aug ~7 days (dry season), London Nov ~10 days/~4 h.
 */
const RAINY_DAY_MM = 2.5;
const RAIN_HOUR_MM = 0.5;
/** Bump when the rain statistics change, so cached cells are re-fetched. */
export const RAIN_METHOD_VERSION = 2;
// Open-Meteo free tier: 600 calls/minute and 5,000/hour - keep headroom on both
const FREE_TIER_MINUTE_CALLS = 550;
const FREE_TIER_HOURLY_CALLS = 4_500;

interface NasaCell {
  elevation: number;
  t: number[];
  range: number[];
  precip: number[];
}

interface RainCell {
  historyYears: number;
  method: number;
  rainyDays: number[];
  rainHoursPerRainyDay: number[];
}

export interface ClimateGeneratorState {
  nasa: Record<string, NasaCell>;
  rain: Record<string, RainCell>;
  /** Open-Meteo calls spent per UTC day, to respect the free-tier daily limit across runs. */
  openMeteoUsage?: { day: string; calls: number };
}

export interface ClimateGeneratorOptions {
  /** Current airport and route datasets: climate is generated for airports with airline routes. */
  airports: Pick<AirportRecord, 'code' | 'lat' | 'lon' | 'altitude'>[];
  flightRoutes: Record<string, string>;
  state: ClimateGeneratorState;
  /** Persist progress (called periodically and at the end). */
  saveState: (state: ClimateGeneratorState) => Promise<void>;
  /** null = no licensed Open-Meteo access: rain-duration columns are left out. */
  openMeteo: OpenMeteoAccess | null;
  log?: (message: string) => void;
  /**
   * The currently published dataset. Rain-duration columns already in it are kept instead of
   * re-fetched, so the published data itself is the resume point: a fresh cache (CI, a new
   * server) continues where the last run stopped instead of starting over or dropping columns.
   * Previously fetched Open-Meteo data stays usable even without current API access - the data
   * is CC BY 4.0; only the free API *service* is limited to non-commercial use.
   */
  previousData?: Record<string, number[]>;
  /** Stop fetching rain data after this long (e.g. to fit a CI job timeout); resumes next run. */
  maxRainRuntimeMs?: number;
  /** Restrict the run to these destination codes (smoke tests). */
  onlyCodes?: string[];
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => Date;
}

export interface ClimateGeneratorResult {
  data: Record<string, number[]>;
  destinations: number;
  withRainDuration: number;
  /** False while Open-Meteo cells are still pending (budget exhausted); rerun later to continue. */
  complete: boolean;
}

interface Point {
  code: string;
  lat: number;
  lon: number;
  elevation: number;
}

export function climateCellOf(lat: number, lon: number): string {
  const cLat = Math.round(lat / 0.5) * 0.5;
  const cLon = Math.round(lon / 0.625) * 0.625;
  return `${cLat.toFixed(2)},${cLon.toFixed(3)}`;
}

function collectPoints(options: ClimateGeneratorOptions): Point[] {
  const { airports, flightRoutes: routes, onlyCodes } = options;
  const points: Point[] = [];
  for (const a of airports) {
    if (!routes[a.code]) continue;
    points.push({ code: a.code, lat: a.lat, lon: a.lon, elevation: (a.altitude || 0) * 0.3048 });
  }
  for (const s of SURFACE_DESTINATIONS) {
    points.push({ code: s.code, lat: s.lat, lon: s.lon, elevation: s.altitudeMeters });
  }
  if (!onlyCodes) return points;
  const wanted = new Set(onlyCodes.map((c) => c.toLowerCase()));
  return points.filter((p) => wanted.has(p.code.toLowerCase()));
}

async function fetchWithRetry(
  url: string,
  fetchImpl: typeof fetch,
  sleep: (ms: number) => Promise<void>,
  init?: RequestInit
): Promise<any> {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetchImpl(url, init);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (attempt === 4) throw err;
      // Both APIs throttle bursts with HTTP 429: back off generously
      await sleep((String((err as Error).message).includes('429') ? 15_000 : 2_000) * attempt);
    }
  }
}

async function fetchNasaCell(cell: string, fetchImpl: typeof fetch, sleep: (ms: number) => Promise<void>): Promise<NasaCell> {
  const [lat, lon] = cell.split(',');
  const url = `https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=T2M,T2M_RANGE,PRECTOTCORR&community=RE&longitude=${lon}&latitude=${lat}&format=JSON`;
  const data = await fetchWithRetry(url, fetchImpl, sleep, {
    headers: { 'User-Agent': 'famvacay-climate-generator/1.0 (https://famvacay.us)' },
  });
  const p = data.properties.parameter;
  return {
    elevation: data.geometry?.coordinates?.[2] ?? 0,
    t: MONTHS.map((m) => p.T2M[m]),
    range: MONTHS.map((m) => p.T2M_RANGE[m]),
    precip: MONTHS.map((m) => p.PRECTOTCORR[m]),
  };
}

/** Last `years` complete calendar years (the archive lags a few days behind today). */
export function historyWindow(years: number, now: Date): { start: string; end: string; days: number } {
  const endYear = now.getUTCFullYear() - 1;
  const startYear = endYear - years + 1;
  const start = `${startYear}-01-01`;
  const end = `${endYear}-12-31`;
  const days = Math.round((Date.UTC(endYear, 11, 31) - Date.UTC(startYear, 0, 1)) / 86_400_000) + 1;
  return { start, end, days };
}

/**
 * Per-month rainy days (averaged per year) and mean hours of noticeable rain on those days,
 * from an hourly local-time precipitation series ("YYYY-MM-DDTHH:MM", mm per hour).
 */
export function summarizeRain(time: string[], precipitation: (number | null)[], historyYears: number): RainCell {
  const days = new Map<string, { total: number; rainHours: number }>();
  for (let i = 0; i < time.length; i++) {
    const mm = precipitation[i];
    if (mm == null) continue;
    const day = time[i].slice(0, 10);
    const d = days.get(day) ?? { total: 0, rainHours: 0 };
    d.total += mm;
    if (mm >= RAIN_HOUR_MM) d.rainHours++;
    days.set(day, d);
  }
  const rainyCount = new Array(12).fill(0);
  const rainyHours = new Array(12).fill(0);
  const yearsSeen: Set<string>[] = Array.from({ length: 12 }, () => new Set());
  for (const [day, d] of days) {
    const month = Number(day.slice(5, 7)) - 1;
    yearsSeen[month].add(day.slice(0, 4));
    if (d.total >= RAINY_DAY_MM) {
      rainyCount[month]++;
      rainyHours[month] += d.rainHours;
    }
  }
  return {
    historyYears,
    method: RAIN_METHOD_VERSION,
    rainyDays: rainyCount.map((n, m) => Math.round((n / Math.max(1, yearsSeen[m].size)) * 10) / 10),
    rainHoursPerRainyDay: rainyCount.map((n, m) => (n > 0 ? Math.round((rainyHours[m] / n) * 10) / 10 : 0)),
  };
}

export async function generateClimateNormals(options: ClimateGeneratorOptions): Promise<ClimateGeneratorResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const now = options.now ?? (() => new Date());
  const log = options.log ?? (() => {});
  const { state } = options;
  state.nasa ||= {};
  state.rain ||= {};

  const points = collectPoints(options);
  const cellPoints = new Map<string, Point>();
  for (const p of points) {
    const cell = climateCellOf(p.lat, p.lon);
    if (!cellPoints.has(cell)) cellPoints.set(cell, p);
  }
  const cells = [...cellPoints.keys()];

  // ---- NASA POWER climatology (temperature, range, precipitation) ----
  const nasaTodo = cells.filter((c) => !state.nasa[c]);
  log(`${points.length} destinations in ${cells.length} grid cells, ${nasaTodo.length} NASA cells to fetch`);
  let nasaDone = 0;
  const nasaQueue = [...nasaTodo];
  const nasaWorker = async () => {
    while (nasaQueue.length) {
      const cell = nasaQueue.shift()!;
      try {
        state.nasa[cell] = await fetchNasaCell(cell, fetchImpl, sleep);
      } catch (err) {
        log(`  NASA ${cell}: ${(err as Error).message}`);
      }
      if (++nasaDone % 50 === 0) {
        await options.saveState(state);
        log(`  NASA ${nasaDone}/${nasaTodo.length}`);
      }
    }
  };
  await Promise.all([nasaWorker(), nasaWorker()]);
  await options.saveState(state);

  // ---- Open-Meteo archive (rain duration), within the licensed tier's budget ----
  let rainPending = 0;
  const access = options.openMeteo;

  // Rain columns of the published dataset count as already fetched
  if (options.previousData) {
    for (const p of points) {
      const cell = climateCellOf(p.lat, p.lon);
      const row = options.previousData[p.code];
      if (state.rain[cell] || !row || row.length < 60) continue;
      state.rain[cell] = {
        // Unknown for published rows: assume they match the current tier and method, so they are kept
        historyYears: access?.historyYears ?? 0,
        method: RAIN_METHOD_VERSION,
        rainyDays: row.slice(36, 48),
        rainHoursPerRainyDay: row.slice(48, 60),
      };
    }
  }

  if (!access) {
    log('Open-Meteo: no licensed access (commercial mode without OPEN_METEO_API_KEY) - no new rain-duration data fetched');
  } else {
    const window = historyWindow(access.historyYears, now());
    const cost = openMeteoCallCost(window.days, 1);
    // Re-fetch cells whose history length no longer matches the tier (e.g. after upgrading to
    // paid) or that were computed with an older method
    const rainTodo = cells.filter(
      (c) => state.rain[c]?.historyYears !== access.historyYears || state.rain[c]?.method !== RAIN_METHOD_VERSION
    );
    // Free tier: respect the per-minute and per-hour limits; paid plans only have a monthly budget
    const minIntervalMs = access.tier === 'free' ? Math.ceil((cost / FREE_TIER_MINUTE_CALLS) * 60_000) : 250;
    const hourWindow: { at: number; calls: number }[] = [];
    const runStarted = Date.now();
    log(`Open-Meteo (${access.tier}): ${rainTodo.length} cells to fetch, ${access.historyYears} years, ~${cost.toFixed(0)} calls each`);

    for (const cell of rainTodo) {
      const remaining = rainTodo.length - rainTodo.indexOf(cell);
      if (options.maxRainRuntimeMs !== undefined && Date.now() - runStarted >= options.maxRainRuntimeMs) {
        rainPending = remaining;
        log(`Open-Meteo: run-time limit reached, ${rainPending} cells continue on the next run`);
        break;
      }
      const today = now().toISOString().slice(0, 10);
      if (state.openMeteoUsage?.day !== today) state.openMeteoUsage = { day: today, calls: 0 };
      if (state.openMeteoUsage.calls + cost > access.dailyCallBudget) {
        rainPending = remaining;
        log(`Open-Meteo: daily budget of ${access.dailyCallBudget} calls reached, ${rainPending} cells continue on the next run`);
        break;
      }
      if (access.tier === 'free') {
        // Rolling one-hour window: wait for the oldest calls to age out before exceeding it
        for (;;) {
          while (hourWindow.length && Date.now() - hourWindow[0].at >= 3_600_000) hourWindow.shift();
          if (hourWindow.reduce((s, e) => s + e.calls, 0) + cost <= FREE_TIER_HOURLY_CALLS) break;
          const waitMs = 3_600_000 - (Date.now() - hourWindow[0].at) + 1_000;
          if (options.maxRainRuntimeMs !== undefined && Date.now() - runStarted + waitMs >= options.maxRainRuntimeMs) break;
          await sleep(waitMs);
        }
        if (hourWindow.reduce((s, e) => s + e.calls, 0) + cost > FREE_TIER_HOURLY_CALLS) {
          rainPending = remaining;
          log(`Open-Meteo: hourly limit reached within the run-time limit, ${rainPending} cells continue on the next run`);
          break;
        }
        hourWindow.push({ at: Date.now(), calls: cost });
      }
      const p = cellPoints.get(cell)!;
      // Query the destination's own coordinates (not the cell centre): Open-Meteo's grid is finer
      // than NASA's, and a cell centre can fall into the sea next to an island destination.
      const url = withOpenMeteoKey(
        `${access.archiveUrl}?latitude=${p.lat}&longitude=${p.lon}&start_date=${window.start}&end_date=${window.end}&hourly=precipitation&timezone=auto`,
        access
      );
      const started = Date.now();
      try {
        const data = await fetchWithRetry(url, fetchImpl, sleep);
        state.rain[cell] = summarizeRain(data.hourly.time, data.hourly.precipitation, access.historyYears);
      } catch (err) {
        log(`  Open-Meteo ${cell}: ${(err as Error).message}`);
      }
      state.openMeteoUsage.calls += cost;
      if (Object.keys(state.rain).length % 25 === 0) await options.saveState(state);
      const wait = minIntervalMs - (Date.now() - started);
      if (wait > 0) await sleep(wait);
    }
    await options.saveState(state);
  }

  // ---- Assemble rows ----
  const data: Record<string, number[]> = {};
  let withRainDuration = 0;
  for (const p of points) {
    const cell = climateCellOf(p.lat, p.lon);
    const c = state.nasa[cell];
    if (!c || c.t.some((v) => v === -999 || v === undefined)) continue;
    const correction = (c.elevation - p.elevation) * LAPSE_RATE;
    const row = [
      ...c.t.map((v) => Math.round(v + correction)),
      ...c.range.map((v) => Math.round(v)),
      ...c.precip.map((v) => Math.round(v * 10) / 10),
    ];
    const rain = state.rain[cell];
    if (rain) {
      row.push(...rain.rainyDays, ...rain.rainHoursPerRainyDay);
      withRainDuration++;
    }
    data[p.code] = row;
  }

  return { data, destinations: Object.keys(data).length, withRainDuration, complete: rainPending === 0 };
}
