import { describe, it, expect } from 'vitest';
import {
  NEUTRAL_FILTER_VALUES,
  applyResultFilters,
  countResultFilterOptions,
  isResultFilterApplicable,
  type ResultFilterState,
} from './result-filters';
import type { CandidateWindow } from '../optimizer/types';

const win = (overrides: Partial<CandidateWindow>): CandidateWindow =>
  ({
    startDate: '2027-06-05',
    endDate: '2027-06-12',
    durationDays: 8,
    destinationAirport: 'VCE',
    estimatedTotalCost: 1500,
    finalScore: 80,
    ...overrides,
  }) as CandidateWindow;

const plane = win({ travelVehicle: 'PLANE', flightDistanceKm: 450, flightStops: 0, isDirectFlight: true });
const car = win({ travelVehicle: 'CAR', vehicleDetails: { distanceKm: 600, durationMinutes: 420 } as any, availableVehicles: ['CAR', 'PLANE'] });
const train = win({ travelVehicle: 'TRAIN', startDate: '2027-07-03', vehicleDetails: { distanceKm: 600, durationMinutes: 380 } as any });

const state = (overrides: Partial<ResultFilterState> = {}): ResultFilterState => ({ ...NEUTRAL_FILTER_VALUES, ...overrides });

describe('Result filters', () => {
  it('filters by the trip\'s own vehicle (a car trip to a destination with an airport is no flight)', () => {
    expect(applyResultFilters([plane, car, train], state({ vehicle: 'PLANE' }))).toEqual([plane]);
    expect(applyResultFilters([plane, car, train], state({ vehicle: 'CAR' }))).toEqual([car]);
  });

  it('filters by year and month, and still understands month-only values', () => {
    expect(applyResultFilters([plane, train], state({ month: '2027-07' }))).toEqual([train]);
    expect(applyResultFilters([plane, train], state({ month: '06' }))).toEqual([plane]);
  });

  it('counts each option against the other active filters only', () => {
    const counts = countResultFilterOptions([plane, car, train], state({ vehicle: 'CAR', month: '2027-06' }), {
      vehicle: ['ALL', 'PLANE', 'CAR', 'TRAIN', 'BUS'],
      month: ['ALL', '2027-06', '2027-07'],
    });
    // Vehicle counts ignore the vehicle filter but respect the June filter
    expect(counts.vehicle).toEqual({ ALL: 2, PLANE: 1, CAR: 1, TRAIN: 0, BUS: 0 });
    // Month counts ignore the month filter but respect the car filter
    expect(counts.month).toEqual({ ALL: 1, '2027-06': 1, '2027-07': 0 });
  });

  it('knows when flight-only or overland-only filters cannot apply', () => {
    const carOnly = [car, train];
    expect(isResultFilterApplicable(carOnly, state(), 'flightStops')).toBe(false);
    expect(isResultFilterApplicable(carOnly, state(), 'overlandDuration')).toBe(true);
    expect(isResultFilterApplicable([plane], state(), 'overlandDuration')).toBe(false);
    // ... given the other filters: with "plane only" there is nothing overland left to limit
    expect(isResultFilterApplicable([plane, car], state({ vehicle: 'PLANE' }), 'overlandDuration')).toBe(false);
  });

  it('keeps overland trips when limiting flight stops and flights when limiting overland time', () => {
    const connecting = win({ travelVehicle: 'PLANE', flightStops: 1 });
    expect(applyResultFilters([connecting, car], state({ flightStops: 'DIRECT_ONLY' }))).toEqual([car]);
    expect(applyResultFilters([plane, car], state({ overlandDuration: '360' }))).toEqual([plane]);
  });

  it('filters for quiet travel periods and hides school-holiday peak warnings under CLEAN_ONLY', () => {
    const quiet = win({ sourceMarketDemand: { index: 0.05, marketsOnHoliday: [] } });
    const moderate = win({ sourceMarketDemand: { index: 0.25, marketsOnHoliday: ['NL'] } });
    const busy = win({
      sourceMarketDemand: { index: 0.75, marketsOnHoliday: ['DE', 'GB', 'FR'] },
      seasonalWarning: {
        destinationCode: 'PMI',
        seasonType: 'OVERCROWDED_PEAK',
        monthRange: [7],
        messageKey: 'seasonWarningCrowdedPeak',
        fallbackMessage: 'Busy',
        eventKey: 'school_holidays',
        marketsOnHoliday: ['DE', 'GB', 'FR'],
      },
    });
    expect(applyResultFilters([quiet, moderate, busy], state({ warning: 'CLEAN_ONLY' }))).toEqual([quiet, moderate]);
    expect(applyResultFilters([quiet, moderate, busy], state({ seasonalInfo: 'QUIET_ONLY' }))).toEqual([quiet]);
    expect(applyResultFilters([quiet, moderate, busy], state({ warning: 'ALL', seasonalInfo: 'ALL' }))).toEqual([quiet, moderate, busy]);
  });

  it('selectively shows allowed warning types under CLEAN_ONLY', () => {
    const monsoon = win({
      seasonalWarning: { destinationCode: 'CUN', seasonType: 'MONSOON', monthRange: [6], messageKey: 'seasonWarningMonsoon', fallbackMessage: 'Monsoon' },
    });
    const springBreak = win({
      seasonalWarning: { destinationCode: 'CUN', seasonType: 'OVERCROWDED_PEAK', monthRange: [3], messageKey: 'seasonWarningCrowdedPeak', fallbackMessage: 'Crowded', eventKey: 'spring_break' },
    });
    const schoolHolidays = win({
      seasonalWarning: { destinationCode: 'PMI', seasonType: 'OVERCROWDED_PEAK', monthRange: [7], messageKey: 'seasonWarningCrowdedPeak', fallbackMessage: 'Busy', eventKey: 'school_holidays' },
    });
    const all = [plane, monsoon, springBreak, schoolHolidays];

    expect(
      applyResultFilters(all, state({ warning: 'CLEAN_ONLY', allowedWarnings: ['OVERCROWDED_PEAK:school_holidays'] }))
    ).toEqual([plane, schoolHolidays]);

    expect(
      applyResultFilters(all, state({ warning: 'CLEAN_ONLY', allowedWarnings: ['MONSOON', 'OVERCROWDED_PEAK:spring_break'] }))
    ).toEqual([plane, monsoon, springBreak]);
  });

  it('filters destination safety by advisory level (LEVEL_1, SAFE_ONLY / Level 2, ALL)', () => {
    const level1 = win({ destinationSafety: { level: 'SAFE', advisoryLevel: 1, isSafe: true } as any });
    const level2 = win({ destinationSafety: { level: 'CAUTION', advisoryLevel: 2, isSafe: true, hasGermanPartialWarning: true } as any });
    const level3 = win({ destinationSafety: { level: 'WARNING', advisoryLevel: 3, isSafe: false } as any });

    expect(applyResultFilters([level1, level2, level3], state({ safety: 'LEVEL_1' }))).toEqual([level1]);
    expect(applyResultFilters([level1, level2, level3], state({ safety: 'SAFE_ONLY' }))).toEqual([level1, level2]);
    expect(applyResultFilters([level1, level2, level3], state({ safety: 'ALL' }))).toEqual([level1, level2, level3]);
  });
});

describe('Explaining hidden results', () => {
  it('lists each active filter with the results it hides, adding up to found - shown', async () => {
    const { explainResultFilterExclusions } = await import('./result-filters');
    const warned = win({ travelVehicle: 'PLANE', seasonalWarning: { seasonType: 'ALGAE' } as any });
    const all = [plane, car, train, warned];
    const s = state({ vehicle: 'PLANE', warning: 'CLEAN_ONLY' });
    const rows = explainResultFilterExclusions(all, s);
    expect(rows).toEqual([
      { key: 'vehicle', excluded: 2 },
      { key: 'warning', warningKey: 'ALGAE', excluded: 1 },
    ]);
    expect(rows.reduce((n, r) => n + r.excluded, 0)).toBe(all.length - applyResultFilters(all, s).length);
  });

  it('breaks down hidden seasonal warnings by individual warning type', async () => {
    const { explainResultFilterExclusions } = await import('./result-filters');
    const algae = win({ travelVehicle: 'PLANE', seasonalWarning: { seasonType: 'ALGAE' } as any });
    const schoolHolidays = win({
      travelVehicle: 'PLANE',
      seasonalWarning: { seasonType: 'OVERCROWDED_PEAK', eventKey: 'school_holidays' } as any,
    });
    const springBreak = win({
      travelVehicle: 'PLANE',
      seasonalWarning: { seasonType: 'OVERCROWDED_PEAK', eventKey: 'spring_break' } as any,
    });
    const all = [plane, algae, schoolHolidays, springBreak];
    const s = state({ warning: 'CLEAN_ONLY', allowedWarnings: ['ALGAE'] });
    const rows = explainResultFilterExclusions(all, s);
    expect(rows).toEqual([
      { key: 'warning', warningKey: 'OVERCROWDED_PEAK:school_holidays', excluded: 1 },
      { key: 'warning', warningKey: 'OVERCROWDED_PEAK:spring_break', excluded: 1 },
    ]);
    expect(rows.reduce((n, r) => n + r.excluded, 0)).toBe(all.length - applyResultFilters(all, s).length);
  });
});
