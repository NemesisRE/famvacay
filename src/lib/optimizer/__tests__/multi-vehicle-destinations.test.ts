import { describe, it, expect } from 'vitest';
import { optimizeVacationWindows } from '../engine';
import type { TripPlanInput } from '../types';

const karlsruhe = (targetDestinations: string[], overrides: Partial<TripPlanInput> = {}): TripPlanInput => ({
  targetDestinations,
  durationDays: 7,
  earliestDate: '2027-06-01',
  latestDate: '2027-06-20',
  travelVehicles: ['PLANE', 'CAR', 'TRAIN'],
  railAirSuggestions: false,
  ...overrides,
  userProfile: {
    homeLocation: 'Karlsruhe',
    departureLat: 49.0069,
    departureLon: 8.4037,
    federalState: 'DE-BW',
    originAirports: ['FKB', 'STR', 'FRA'],
    childrenAges: [],
    blackoutRanges: [],
  },
});

describe('A destination can be reached by several vehicles', () => {
  it('offers car, train and plane trips to the same destination (Venice)', () => {
    const res = optimizeVacationWindows(karlsruhe(['VCE']), {}, {});
    const vehicles = new Set(res.map((w) => w.travelVehicle));
    expect(vehicles).toEqual(new Set(['PLANE', 'CAR', 'TRAIN']));
    expect(new Set(res.map((w) => w.destinationAirport))).toEqual(new Set(['VCE']));
  });

  it('keeps only overland vehicles the family selected', () => {
    const res = optimizeVacationWindows(karlsruhe(['VCE'], { travelVehicles: ['PLANE', 'CAR'] }), {}, {});
    expect(new Set(res.map((w) => w.travelVehicle))).toEqual(new Set(['PLANE', 'CAR']));
  });

  it('does not offer a flight for a short hop reachable overland', () => {
    // Zurich is ~175 km from Karlsruhe
    const res = optimizeVacationWindows(karlsruhe(['ZRH']), {}, {});
    expect(res.length).toBeGreaterThan(0);
    expect(res.some((w) => w.travelVehicle === 'PLANE')).toBe(false);
  });
});

describe('School-child flag per window', () => {
  const withChild = (birthDate: string) =>
    optimizeVacationWindows(
      {
        ...karlsruhe(['VCE'], { travelVehicles: ['PLANE'] }),
        userProfile: { ...karlsruhe(['VCE']).userProfile, childrenBirthDates: [birthDate], childrenAges: [] },
      },
      { 'DE-BW': [{ startDate: '2027-06-01', endDate: '2027-06-20', name: 'Ferien', state: 'DE-BW' }] },
      {}
    );

  it('is false for a toddler even though the home school calendar is tracked', () => {
    const res = withChild('2023-05-01');
    expect(res.length).toBeGreaterThan(0);
    expect(res.some((w) => (w.schoolHolidayDaysOverlap ?? 0) > 0)).toBe(true);
    expect(res.every((w) => !w.travelsWithSchoolChildren)).toBe(true);
  });

  it('is true when a child is school-age at departure', () => {
    expect(withChild('2017-05-01').every((w) => w.travelsWithSchoolChildren)).toBe(true);
  });
});
