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
});
