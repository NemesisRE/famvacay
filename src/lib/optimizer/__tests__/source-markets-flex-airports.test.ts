import { describe, it, expect } from 'vitest';
import {
  SOURCE_MARKETS,
  buildMarketCalendar,
  computeSourceMarketDemand,
  getMarketHolidayShare,
  getTypicalSchoolHolidays,
  isCalendarYearComplete,
  type MarketHolidayCalendar,
} from '../../holidays/source-markets';
import { getDemandPriceFactor, keepBestOriginPerWindow, optimizeVacationWindows } from '../engine';
import { resolveFlexOriginAirports } from '../../airports/flight-routes';
import type { CandidateWindow, TripPlanInput } from '../types';

const market = (country: string) => SOURCE_MARKETS.find((m) => m.country === country)!;

/** Typical calendars for every market: deterministic stand-in for the OpenHolidays data */
function typicalCalendars(year: number): MarketHolidayCalendar[] {
  return SOURCE_MARKETS.map((m) => {
    const periods = getTypicalSchoolHolidays(m.country, year);
    // Markets without a typical pattern: a German-style summer break (late July - early September)
    return buildMarketCalendar(
      m,
      periods.length > 0 ? periods : [{ startDate: `${year}-07-25`, endDate: `${year}-09-05`, subdivisions: [] }],
      'typical'
    );
  });
}

describe('Source-market school holiday calendars', () => {
  it('builds typical calendars for markets OpenHolidays does not cover', () => {
    const gb = buildMarketCalendar(market('GB'), getTypicalSchoolHolidays('GB', 2027), 'typical');
    expect(getMarketHolidayShare(gb, '2027-08-10')).toBe(1);
    expect(getMarketHolidayShare(gb, '2027-06-15')).toBe(0);
    // Easter 2027 is March 28
    expect(getMarketHolidayShare(gb, '2027-03-29')).toBe(1);

    const it_ = buildMarketCalendar(market('IT'), getTypicalSchoolHolidays('IT', 2027), 'typical');
    expect(getMarketHolidayShare(it_, '2027-06-20')).toBe(1);
    expect(getTypicalSchoolHolidays('DE', 2027)).toEqual([]);
  });

  it('detects incomplete official data (no summer break) so typical calendars take over', () => {
    // OpenHolidays 2027 for France so far only lists overseas territories
    const overseasOnly = [{ startDate: '2026-12-20', endDate: '2027-01-31', subdivisions: ['FR-RE'] }];
    expect(isCalendarYearComplete(overseasOnly, 2027)).toBe(false);
    expect(isCalendarYearComplete(getTypicalSchoolHolidays('FR', 2027), 2027)).toBe(true);
    expect(isCalendarYearComplete(getTypicalSchoolHolidays('PL', 2027), 2027)).toBe(true);
  });

  it('counts the share of regions on holiday for regional calendars', () => {
    const de = buildMarketCalendar(
      market('DE'),
      [
        { startDate: '2027-07-01', endDate: '2027-08-10', subdivisions: ['DE-NW', 'DE-HE'] },
        { startDate: '2027-07-29', endDate: '2027-09-10', subdivisions: ['DE-BW', 'DE-BY'] },
      ],
      'school-calendar'
    );
    expect(getMarketHolidayShare(de, '2027-07-10')).toBe(0.5);
    expect(getMarketHolidayShare(de, '2027-08-01')).toBe(1);
    expect(getMarketHolidayShare(de, '2027-09-01')).toBe(0.5);
  });

  it('rates late July far busier than mid-June, and damps long-haul exposure', () => {
    const calendars = typicalCalendars(2027);
    const june = computeSourceMarketDemand(calendars, '2027-06-12', '2027-06-18', 'ES');
    const july = computeSourceMarketDemand(calendars, '2027-07-31', '2027-08-06', 'ES');
    expect(july.index).toBeGreaterThan(0.9);
    expect(june.index).toBeLessThan(0.3);
    expect(july.marketsOnHoliday.slice(0, 2)).toEqual(['DE', 'GB']);

    const longHaul = computeSourceMarketDemand(calendars, '2027-07-31', '2027-08-06', 'TH', true);
    expect(longHaul.index).toBeLessThan(july.index);
  });

  it('weights domestic holidays higher (Italian beaches when Italy is on holiday)', () => {
    const calendars = typicalCalendars(2027);
    const atHome = computeSourceMarketDemand(calendars, '2027-06-20', '2027-06-26', 'IT');
    const abroad = computeSourceMarketDemand(calendars, '2027-06-20', '2027-06-26', 'GR');
    expect(atHome.index).toBeGreaterThan(abroad.index);
  });
});

describe('Demand price factor', () => {
  it('only adds what the month-based benchmark does not already price in', () => {
    // Christmas is covered by the existing surge
    expect(getDemandPriceFactor({ index: 0.9, marketsOnHoliday: [] }, '2027-12-22')).toBe(0);
    // Easter with many markets off: surcharge
    expect(getDemandPriceFactor({ index: 0.6, marketsOnHoliday: [] }, '2027-03-27')).toBeGreaterThan(0.1);
    // Early June inside the summer price band but few markets travelling: cheaper
    expect(getDemandPriceFactor({ index: 0.1, marketsOnHoliday: [] }, '2027-06-05')).toBeLessThan(0);
    // Peak summer: above the summer baseline
    expect(getDemandPriceFactor({ index: 1, marketsOnHoliday: [] }, '2027-08-01')).toBeGreaterThan(0);
    expect(getDemandPriceFactor(undefined, '2027-08-01')).toBe(0);
  });
});

const baseInput = (overrides: Partial<TripPlanInput> = {}): TripPlanInput => ({
  targetDestinations: ['PMI'],
  durationDays: 7,
  earliestDate: '2027-03-20',
  latestDate: '2027-04-10',
  travelVehicles: ['PLANE'],
  ...overrides,
  userProfile: {
    homeLocation: 'Karlsruhe',
    departureLat: 49.0069,
    departureLon: 8.4037,
    federalState: 'DE-BW',
    originAirports: ['FRA'],
    childrenAges: [],
    blackoutRanges: [],
    ...(overrides.userProfile || {}),
  },
});

describe('Optimizer with source-market demand', () => {
  it('prices Easter windows higher when several big markets are on holiday', () => {
    const input = baseInput({ maxWindowsPerDestination: 0, railAirSuggestions: false });
    const calendars = typicalCalendars(2027);
    const without = optimizeVacationWindows(input, {}, {}, undefined, {});
    const withDemand = optimizeVacationWindows(input, {}, {}, undefined, { sourceMarketCalendars: calendars });

    const pick = (list: CandidateWindow[]) => list.find((w) => w.startDate === '2027-03-27' && w.originAirport === 'FRA')!;
    const a = pick(without);
    const b = pick(withDemand);
    expect(a.sourceMarketDemand).toBeUndefined();
    expect(b.sourceMarketDemand!.marketsOnHoliday).toContain('GB');
    expect(b.estimatedTotalCost).toBeGreaterThan(a.estimatedTotalCost);
    expect(b.pricingDetails!.demandAdjustmentEur).toBe(b.estimatedTotalCost - a.estimatedTotalCost);
  });

  it('turns high European school-holiday demand into an OVERCROWDED_PEAK seasonal warning with penalty', async () => {
    const { getLocalizedSeasonalWarning, getWindowSeasonalWarnings } = await import('../localized-warnings');
    const { en } = await import('../../i18n/locales/en');
    const input = baseInput({
      earliestDate: '2027-07-28',
      latestDate: '2027-08-10',
      maxWindowsPerDestination: 0,
      railAirSuggestions: false,
    });
    const calendars = typicalCalendars(2027);
    const without = optimizeVacationWindows(input, {}, {}, undefined, {});
    const withDemand = optimizeVacationWindows(input, {}, {}, undefined, { sourceMarketCalendars: calendars });

    const pick = (list: CandidateWindow[]) => list.find((w) => w.startDate === '2027-07-31' && w.originAirport === 'FRA')!;
    const a = pick(without);
    const b = pick(withDemand);

    expect(a.seasonalWarning).toBeFalsy();
    expect(b.seasonalWarning).toBeDefined();
    expect(b.seasonalWarning!.seasonType).toBe('OVERCROWDED_PEAK');
    expect(b.seasonalWarning!.eventKey).toBe('school_holidays');
    expect(b.seasonalWarning!.marketsOnHoliday).toEqual(expect.arrayContaining(['DE', 'GB', 'FR']));
    expect(b.seasonalWarningPenalty).toBe(12);

    const localized = getLocalizedSeasonalWarning(b.seasonalWarning!, en, 'en');
    expect(localized.title).toContain(en.home.seasonWarningCrowdedPeakTitle);
    expect(localized.title).toContain('Busy: holidays in');
    expect(localized.description).toContain(en.home.seasonWarningCrowdedPeakDesc);
    expect(localized.description).toContain(en.home.demandTitle);

    // Also works when hydrated from cached/shared windows or alongside another warning (e.g. Spring Break)
    const hydratedWarnings = getWindowSeasonalWarnings({
      destinationAirport: 'PMI',
      startDate: '2027-07-31',
      seasonalWarning: null,
      sourceMarketDemand: { index: 0.8, marketsOnHoliday: ['DE', 'GB'] },
    });
    expect(hydratedWarnings).toHaveLength(1);
    expect(hydratedWarnings[0].eventKey).toBe('school_holidays');
  });
});

describe('Flexible departure airport', () => {
  it('picks nearby airports with real route data plus the big hubs in reach', () => {
    const ka = resolveFlexOriginAirports(49.0069, 8.4037);
    expect(ka[0]).toBe('FKB');
    expect(ka).toEqual(expect.arrayContaining(['FKB', 'STR', 'FRA']));
    expect(ka.length).toBeLessThanOrEqual(6);
    // Berlin: the 2014 Tegel/Schoenefeld routes are mapped to BER
    expect(resolveFlexOriginAirports(52.52, 13.405)[0]).toBe('BER');
  });

  it('keeps only the best departure airport per destination and window', () => {
    const results = optimizeVacationWindows(
      baseInput({
        targetDestinations: ['PMI', 'JFK'],
        earliestDate: '2027-05-01',
        latestDate: '2027-05-14',
        destinationTypes: ['ALL'],
        maxWindowsPerDestination: 0,
        userProfile: { originAirports: [] } as any,
      }),
      {},
      {}
    );
    expect(results.length).toBeGreaterThan(0);
    const keys = results.map((w) => `${w.destinationAirport}|${w.startDate}|${w.durationDays}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(results.every((w) => w.autoSelectedOrigin || w.railFeeder)).toBe(true);
    // The chosen airport depends on the destination (non-stop long-haul from a hub)
    const jfk = results.find((w) => w.destinationAirport === 'JFK')!;
    expect(jfk.flightStops).toBe(0);
  });

  it('keepBestOriginPerWindow prefers the higher score, then the lower cost', () => {
    const w = (origin: string, finalScore: number, cost: number) =>
      ({ destinationAirport: 'PMI', startDate: '2027-05-01', durationDays: 7, originAirport: origin, finalScore, estimatedTotalCost: cost } as CandidateWindow);
    expect(keepBestOriginPerWindow([w('STR', 70, 1000), w('FRA', 72, 1500)]).map((c) => c.originAirport)).toEqual(['FRA']);
    expect(keepBestOriginPerWindow([w('STR', 70, 1000), w('FKB', 70, 900)]).map((c) => c.originAirport)).toEqual(['FKB']);
  });
});
