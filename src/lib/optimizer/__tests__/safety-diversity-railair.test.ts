import { describe, it, expect, beforeEach } from 'vitest';
import { optimizeVacationWindows } from '../engine';
import { resolveDestinationCodes, getWorldRegion } from '../destinations';
import {
  setAdvisoryStore,
  isDestinationBanned,
  isDestinationSafeForVacation,
  OFFLINE_FULL_WARNING_COUNTRIES,
  type AdvisoryCacheStore,
} from '../../safety/advisory-store';
import { getAirportByIata } from '../../airports/airport-service';
import type { TripPlanInput } from '../types';

const entry = (iso: string, opts: { full?: boolean; partial?: boolean; us?: 1 | 2 | 3 | 4 }) => ({
  isoCode: iso,
  countryName: iso,
  hasGermanWarning: Boolean(opts.full),
  hasGermanPartialWarning: Boolean(opts.partial),
  usStateDeptLevel: opts.us || 1,
  isSafeForFamilies: !opts.full && (opts.us || 1) < 3,
  safetyScore: opts.full ? 20 : 85,
});

const liveStore = (entries: ReturnType<typeof entry>[]): AdvisoryCacheStore => ({
  timestamp: Date.now(),
  entries: Object.fromEntries(entries.map((e) => [e.isoCode, e])),
});

const KARLSRUHE = {
  homeLocation: 'Karlsruhe',
  departureLat: 49.0069,
  departureLon: 8.4037,
  federalState: 'DE-BW',
  childrenAges: [8],
  blackoutRanges: [],
};

describe('Safety hard-exclusions', () => {
  beforeEach(() => {
    setAdvisoryStore(
      liveStore([
        entry('SA', { full: true }),
        entry('RU', { full: true, us: 4 }),
        entry('EG', { partial: true, us: 3 }),
        entry('TH', { partial: true, us: 1 }),
        entry('MX', { us: 4 }),
      ])
    );
  });

  it('bans full travel warnings and US level 4, but allows partial warnings', () => {
    expect(isDestinationBanned('NUM', 'Saudi Arabia')).toBe(true);
    expect(isDestinationBanned('AER', 'Russia')).toBe(true);
    expect(isDestinationBanned('CUN', 'Mexico')).toBe(true);
    expect(isDestinationBanned('BKK', 'Thailand')).toBe(false); // Teilreisewarnung only
    expect(isDestinationBanned('HRG', 'Egypt')).toBe(false);
  });

  it('strips banned destinations even when the user explicitly asks for them', () => {
    const input: TripPlanInput = {
      targetDestinations: ['NUM', 'BKK'],
      durationDays: 10,
      earliestDate: '2027-03-01',
      latestDate: '2027-03-12',
      travelVehicles: ['PLANE'],
      userProfile: { ...KARLSRUHE, originAirports: ['FRA'] },
    };
    const windows = optimizeVacationWindows(input, {}, {});
    const dests = new Set(windows.map((w) => w.destinationAirport));
    expect(dests.has('NUM')).toBe(false);
    expect(dests.has('BKK')).toBe(true);
  });

  it('keeps US level 3 out of open discovery only', () => {
    expect(isDestinationSafeForVacation('HRG', 'Egypt')).toBe(false);
    expect(isDestinationBanned('HRG', 'Egypt')).toBe(false);
  });

  it('fails closed with the offline snapshot when no live advisories are available', () => {
    setAdvisoryStore({ timestamp: 0, entries: {} });
    expect(OFFLINE_FULL_WARNING_COUNTRIES.has('RU')).toBe(true);
    expect(isDestinationBanned('XXX', 'Saudi Arabia')).toBe(true);
    expect(isDestinationBanned('PMI', 'Spain')).toBe(false);
  });
});

describe('Geographic representation in flexible search', () => {
  beforeEach(() => setAdvisoryStore({ timestamp: 0, entries: {} }));

  it('spreads long-haul discovery across world regions', () => {
    const codes = resolveDestinationCodes(undefined, ['LONGRANGE'], {
      departureLat: 49.0,
      departureLon: 8.4,
      country: 'DE',
      federalState: 'DE-BW',
      originAirports: ['STR', 'FRA'],
      travelVehicles: ['PLANE'],
    });
    const regions = new Set(codes.map((c) => getWorldRegion(getAirportByIata(c)!.lat, getAirportByIata(c)!.lon)));
    // The popular holiday regions; Central Asia only makes it when its destinations are popular
    // enough (discovery ranks by holiday appeal, regions are balanced softly)
    for (const r of ['EAST_ASIA', 'SOUTHEAST_ASIA', 'OCEANIA', 'MIDDLE_EAST', 'NORTH_AMERICA'] as const) {
      expect(regions).toContain(r);
    }
    expect(regions.size).toBeGreaterThanOrEqual(7);
  });

  it('includes Asia in an "all styles" flexible search', () => {
    const codes = resolveDestinationCodes(undefined, ['ALL'], {
      departureLat: 49.0,
      departureLon: 8.4,
      country: 'DE',
      federalState: 'DE-BW',
      originAirports: ['STR', 'FRA'],
      travelVehicles: ['PLANE'],
    });
    const regions = codes.map((c) => getWorldRegion(getAirportByIata(c)!.lat, getAirportByIata(c)!.lon));
    expect(regions.some((r) => r === 'EAST_ASIA' || r === 'SOUTHEAST_ASIA' || r === 'CENTRAL_ASIA')).toBe(true);
  });

  it('classifies world regions geometrically', () => {
    const region = (code: string) => getWorldRegion(getAirportByIata(code)!.lat, getAirportByIata(code)!.lon);
    expect(region('BKK')).toBe('SOUTHEAST_ASIA');
    expect(region('NRT')).toBe('EAST_ASIA');
    expect(region('TAS')).toBe('CENTRAL_ASIA');
    expect(region('SYD')).toBe('OCEANIA');
    expect(region('DXB')).toBe('MIDDLE_EAST');
    expect(region('CUN')).toBe('CARIBBEAN_CENTRAL_AMERICA');
    expect(region('PMI')).toBe('EUROPE_MED');
  });
});

describe('Rail & Fly ("Zug zum Flug")', () => {
  beforeEach(() => setAdvisoryStore(liveStore([])));

  const input = (extra: Partial<TripPlanInput> = {}): TripPlanInput => ({
    targetDestinations: ['JFK', 'PMI'],
    durationDays: 10,
    earliestDate: '2027-03-01',
    latestDate: '2027-03-12',
    travelVehicles: ['PLANE'],
    userProfile: { ...KARLSRUHE, originAirports: ['FKB', 'STR'] },
    ...extra,
  });

  it('replaces regional feeder connections with train + non-stop flight from a rail-reachable hub', () => {
    const windows = optimizeVacationWindows(input(), {}, {});
    const jfk = windows.filter((w) => w.destinationAirport === 'JFK');
    expect(jfk.length).toBeGreaterThan(0);
    const railFed = jfk.filter((w) => w.railFeeder);
    expect(railFed.length).toBeGreaterThan(0);
    for (const w of railFed) {
      expect(w.flightStops).toBe(0);
      expect(w.railFeeder!.isAlternativeOrigin).toBe(true);
      expect(w.railFeeder!.durationMinutes).toBeLessThanOrEqual(330);
      expect(w.railFeeder!.costEur).toBeGreaterThan(0);
      expect(w.parkSleepFlyRecommended).toBe(false);
      expect(w.originAirport).toBe(w.railFeeder!.hubAirport);
    }
    // The superseded ultra-short feeder routings (STR/FKB -> FRA -> JFK) are gone; real connections
    // via distant hubs may remain as alternatives
    expect(jfk.some((w) => (w.flightSegments?.length ?? 0) > 1 && w.flightSegments![0].distanceKm < 500)).toBe(false);
  });

  it('adds the train fare to the trip cost', () => {
    const windows = optimizeVacationWindows(input(), {}, {});
    const w = windows.find((x) => x.railFeeder)!;
    expect(w.estimatedTotalCost).toBe(w.pricingDetails!.totalCost);
    expect(w.pricingDetails!.totalCost).toBeGreaterThan(w.railFeeder!.costEur);
  });

  it('leaves destinations with a direct flight from the family airports alone', () => {
    const windows = optimizeVacationWindows(input(), {}, {});
    for (const w of windows.filter((x) => x.destinationAirport === 'PMI')) {
      expect(w.railFeeder).toBeUndefined();
      expect(['FKB', 'STR']).toContain(w.originAirport);
    }
  });

  it('can be switched off', () => {
    const windows = optimizeVacationWindows(input({ railAirSuggestions: false }), {}, {});
    expect(windows.some((w) => w.railFeeder)).toBe(false);
  });
});

describe('Feeder-flight regressions (Karlsruhe)', () => {
  beforeEach(() => setAdvisoryStore(liveStore([])));

  const search = (originAirports: string[]): TripPlanInput => ({
    targetDestinations: ['FNC', 'HIR'],
    durationDays: 14,
    earliestDate: '2027-03-01',
    latestDate: '2027-03-16',
    travelVehicles: ['PLANE'],
    userProfile: { ...KARLSRUHE, originAirports },
  });

  const shortFirstLeg = (w: { flightSegments?: { distanceKm: number }[] }) =>
    (w.flightSegments?.length ?? 0) > 1 && w.flightSegments![0].distanceKm < 500;

  it('never routes Stuttgart/Karlsruhe -> Frankfurt by plane when Frankfurt is one of the family airports', () => {
    const windows = optimizeVacationWindows(search(['FKB', 'STR', 'FRA']), {}, {});
    const funchal = windows.filter((w) => w.destinationAirport === 'FNC');
    expect(funchal.length).toBeGreaterThan(0);
    // Frankfurt and Stuttgart both fly non-stop to Funchal (real route network); a real connection
    // with a proper first leg (e.g. FKB -> OPO -> FNC) may remain as an alternative
    expect(funchal.some((w) => w.flightStops === 0 && w.originAirport === 'FRA')).toBe(true);
    expect(funchal.some((w) => w.flightSegments?.[0]?.arrivalAirport === 'FRA')).toBe(false);
    expect(windows.some(shortFirstLeg)).toBe(false);
  });

  it('connects long-haul trips from a hub at a real gateway, not at a neighbouring hub', () => {
    const windows = optimizeVacationWindows(search(['FKB', 'STR', 'FRA']), {}, {});
    const honiara = windows.filter((w) => w.destinationAirport === 'HIR');
    expect(honiara.length).toBeGreaterThan(0);
    for (const w of honiara) {
      expect(w.flightSegments![0].distanceKm).toBeGreaterThan(1500);
      expect(w.flightSegments!.some((s) => s.arrivalAirport === 'MUC')).toBe(false);
    }
    expect(windows.some(shortFirstLeg)).toBe(false);
  });

  it('uses the train to the hub instead of a feeder flight when the hub is not a selected airport', () => {
    const windows = optimizeVacationWindows(search(['FKB', 'STR']), {}, {});
    expect(windows.length).toBeGreaterThan(0);
    // Honiara: STR -> FRA -> ... becomes train to the hub + the same connection
    const honiara = windows.filter((w) => w.destinationAirport === 'HIR');
    expect(honiara.length).toBeGreaterThan(0);
    expect(honiara.every((w) => w.railFeeder)).toBe(true);
    expect(windows.some(shortFirstLeg)).toBe(false);
  });
});

describe('Real route network (OpenFlights)', () => {
  it('knows real non-stop routes and connects over routes that exist', async () => {
    const { resolveFlightRoute, hasNonStopRoute } = await import('../../airports/flight-routes');
    expect(hasNonStopRoute('FRA', 'FNC')).toBe(true);
    expect(hasNonStopRoute('FRA', 'HIR')).toBe(false);
    const honiara = resolveFlightRoute('FRA', 'HIR');
    for (let i = 0; i < honiara.segments.length; i++) {
      const seg = honiara.segments[i];
      expect(hasNonStopRoute(seg.departureAirport, seg.arrivalAirport)).toBe(true);
    }
  });

  it('never connects through a country under a full travel warning', async () => {
    setAdvisoryStore({ timestamp: 0, entries: {} }); // offline snapshot includes Russia
    const { resolveFlightRoute } = await import('../../airports/flight-routes');
    const { getAirportByIata } = await import('../../airports/airport-service');
    for (const [o, d] of [['FKB', 'BKK'], ['STR', 'BKK'], ['FKB', 'DEL']]) {
      const route = resolveFlightRoute(o, d);
      for (const layover of route.layovers) {
        expect(getAirportByIata(layover.airportCode)?.country).not.toBe('Russia');
      }
    }
  });
});
