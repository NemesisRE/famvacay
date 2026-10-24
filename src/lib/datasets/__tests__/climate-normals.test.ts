import { describe, it, expect, vi } from 'vitest';
import {
  generateClimateNormals,
  historyWindow,
  summarizeRain,
  type ClimateGeneratorState,
} from '../generators/climate-normals';
import { resolveOpenMeteoAccess, openMeteoCallCost } from '@/lib/integrations/open-meteo-access';
import { getDestinationSeasonalWarning } from '@/lib/optimizer/weather';
import type { WeatherAssessment } from '@/lib/optimizer/types';
import airportsData from '@/lib/airports/data/airports.json';
import flightRoutesData from '@/lib/airports/data/flight-routes.json';

describe('Open-Meteo access by operation mode', () => {
  it('uses the free endpoint only in private mode', () => {
    const access = resolveOpenMeteoAccess({ LEGAL_OPERATION_MODE: 'private' });
    expect(access?.tier).toBe('free');
    expect(access?.archiveUrl).toBe('https://archive-api.open-meteo.com/v1/archive');
    expect(access?.apiKey).toBeUndefined();
  });

  it('never falls back to the non-commercial free tier in commercial mode', () => {
    expect(resolveOpenMeteoAccess({ LEGAL_OPERATION_MODE: 'commercial' })).toBeNull();
  });

  it('uses the paid customer endpoint with the API key whenever one is configured', () => {
    for (const mode of ['commercial', 'private']) {
      const access = resolveOpenMeteoAccess({ LEGAL_OPERATION_MODE: mode, OPEN_METEO_API_KEY: 'abc123' });
      expect(access?.tier).toBe('paid');
      expect(access?.archiveUrl).toBe('https://customer-archive-api.open-meteo.com/v1/archive');
      expect(access?.apiKey).toBe('abc123');
      expect(access?.historyYears).toBe(10);
    }
  });

  it('counts one call per two weeks of data, as Open-Meteo bills it', () => {
    expect(openMeteoCallCost(14, 2)).toBe(1);
    expect(openMeteoCallCost(1095, 1)).toBeCloseTo(78.2, 1);
  });
});

describe('rain statistics', () => {
  it('counts rainy days per year (>= 2.5 mm) and noticeable rain hours (>= 0.5 mm/h) on them', () => {
    // Two Augusts: a 3-hour storm, a drizzle day (2.4 mm over 12 light hours - not rainy), and a
    // long rain day; the long day's 0.3 mm/h drizzle hours do not count as rain hours
    const day = (date: string, perHour: number[]) => perHour.map((_, h) => `${date}T${String(h).padStart(2, '0')}:00`);
    const storm = [0, 0, 4, 6, 2, ...new Array(19).fill(0)];
    const drizzle = [...new Array(12).fill(0.2), ...new Array(12).fill(0)];
    const longRain = [...new Array(5).fill(1), ...new Array(5).fill(0.3), ...new Array(14).fill(0)];
    const time = [...day('2024-08-01', storm), ...day('2024-08-02', drizzle), ...day('2025-08-01', longRain)];
    const cell = summarizeRain(time, [...storm, ...drizzle, ...longRain], 2);
    expect(cell.rainyDays[7]).toBe(1); // 2 rainy days over 2 Augusts
    expect(cell.rainHoursPerRainyDay[7]).toBe(4); // (3 + 5) / 2
    expect(cell.rainyDays[0]).toBe(0);
  });

  it('uses the last complete calendar years', () => {
    const w = historyWindow(3, new Date('2026-10-24T00:00:00Z'));
    expect(w).toEqual({ start: '2023-01-01', end: '2025-12-31', days: 1096 });
  });
});

describe('generateClimateNormals', () => {
  const nasaPayload = {
    geometry: { coordinates: [100.5, 13.75, 5] },
    properties: {
      parameter: Object.fromEntries(
        ['T2M', 'T2M_RANGE', 'PRECTOTCORR'].map((p) => [
          p,
          Object.fromEntries(['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'].map((m) => [m, 5])),
        ])
      ),
    },
  };
  const rainPayload = {
    hourly: { time: ['2025-08-01T14:00', '2025-08-01T15:00'], precipitation: [5, 1] },
  };
  const fakeFetch = vi.fn(async (url: string) => ({
    ok: true,
    status: 200,
    json: async () => (String(url).includes('power.larc.nasa.gov') ? nasaPayload : rainPayload),
  })) as unknown as typeof fetch;

  const run = (state: ClimateGeneratorState, openMeteo: ReturnType<typeof resolveOpenMeteoAccess>, onlyCodes: string[]) =>
    generateClimateNormals({
      airports: airportsData,
      flightRoutes: flightRoutesData,
      state,
      saveState: async () => {},
      openMeteo,
      onlyCodes,
      fetchImpl: fakeFetch,
      sleep: async () => {},
      now: () => new Date('2026-10-24T00:00:00Z'),
    });

  it('appends rain-duration columns when licensed access exists', async () => {
    const access = resolveOpenMeteoAccess({ OPEN_METEO_API_KEY: 'k' });
    const result = await run({ nasa: {}, rain: {} }, access, ['BKK']);
    expect(result.data.BKK).toHaveLength(60);
    expect(result.data.BKK[36 + 7]).toBeGreaterThan(0); // rainy days in August
    expect(result.data.BKK[48 + 7]).toBe(2); // rain hours per rainy day in August
    expect(result.complete).toBe(true);
    const rainCall = (fakeFetch as any).mock.calls.find(([u]: [string]) => u.includes('open-meteo'))[0];
    expect(rainCall).toContain('customer-archive-api.open-meteo.com');
    expect(rainCall).toContain('apikey=k');
  });

  it('keeps the 36-column NASA rows when Open-Meteo is not licensed (commercial without key)', async () => {
    const result = await run({ nasa: {}, rain: {} }, resolveOpenMeteoAccess({ LEGAL_OPERATION_MODE: 'commercial' }), ['BKK']);
    expect(result.data.BKK).toHaveLength(36);
    expect(result.withRainDuration).toBe(0);
  });

  it('stops at the daily call budget and resumes on the next run', async () => {
    const access = { ...resolveOpenMeteoAccess({ LEGAL_OPERATION_MODE: 'private' })!, dailyCallBudget: 100 };
    const state: ClimateGeneratorState = { nasa: {}, rain: {} };
    // ~78 calls each: only the first of two cells fits into a 100-call day
    const first = await run(state, access, ['BKK', 'LHR']);
    expect(first.complete).toBe(false);
    expect(first.withRainDuration).toBe(1);

    state.openMeteoUsage = { day: '2026-10-23', calls: 100 }; // a new day resets the budget
    const second = await run(state, access, ['BKK', 'LHR']);
    expect(second.complete).toBe(true);
    expect(second.withRainDuration).toBe(2);
  });
});

describe('rain-duration aware monsoon classification', () => {
  const tropical = (rainyDays: number, rainHoursPerRainyDay: number, precipitationMmPerDay: number): WeatherAssessment => ({
    avgTempC: 29,
    precipitationRiskPercent: Math.min(95, Math.round((rainyDays / 22) * 100)),
    isSuitable: false,
    rainyDays,
    rainHoursPerRainyDay,
    precipitationMmPerDay,
  });

  it('frequent but short (afternoon storm) rain is only a rainy season', () => {
    // Bangkok in August: ~20 days of ~4 h, 5 mm/day
    const w = getDestinationSeasonalWarning('BKK', 7, { weatherAssessment: tropical(20, 3.5, 5) });
    expect(w?.seasonType).toBe('RAINY_SEASON');
  });

  it('heavy, frequent and long-lasting rain is a monsoon', () => {
    // Bali in January: ~22 days of ~6 h, 10 mm/day
    const w = getDestinationSeasonalWarning('BKK', 7, { weatherAssessment: tropical(22, 5.7, 10) });
    expect(w?.seasonType).toBe('MONSOON');
  });

  it('frequent but light trade-wind showers are not a monsoon', () => {
    // Mauritius in August: ~18 days of ~4 h, but only ~1 mm/day in total
    const w = getDestinationSeasonalWarning('BKK', 7, { weatherAssessment: tropical(18, 4.3, 0.9) });
    expect(w?.seasonType).toBe('RAINY_SEASON');
  });

  it('occasional short showers are no warning at all', () => {
    expect(getDestinationSeasonalWarning('BKK', 7, { weatherAssessment: tropical(7, 2, 1.3) })).toBeNull();
  });
});
