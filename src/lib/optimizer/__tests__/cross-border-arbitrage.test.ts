import { describe, it, expect } from 'vitest';
import { optimizeVacationWindows } from '../engine';
import { resolveFlexOriginAirports } from '../../airports/flight-routes';
import { getTypicalSchoolHolidays } from '../../holidays/source-markets';
import { getSchoolHolidays, toOpenHolidaysSubdivision } from '../../integrations/open-holidays';
import type { SchoolHoliday, TripPlanInput } from '../types';

// Baden-Wuerttemberg 2027 (OpenHolidays): Whitsun and summer break
const BW: SchoolHoliday[] = [
  { startDate: '2027-05-18', endDate: '2027-05-29', name: 'Pfingstferien', state: 'DE-BW' },
  { startDate: '2027-07-29', endDate: '2027-09-11', name: 'Sommerferien', state: 'DE-BW' },
];
// France (typical calendar): summer July 4 - August 31
const FR = getTypicalSchoolHolidays('FR', 2027).map((p) => ({ ...p, name: 'typical', state: 'FR-GES' }));

const offenburg = (overrides: Partial<TripPlanInput> & { originAirports?: string[] } = {}): TripPlanInput => ({
  targetDestinations: ['PMI'],
  durationDays: 7,
  earliestDate: '2027-05-01',
  latestDate: '2027-09-11',
  travelVehicles: ['PLANE'],
  maxWindowsPerDestination: 0,
  railAirSuggestions: false,
  ...overrides,
  userProfile: {
    homeLocation: 'Offenburg',
    departureLat: 48.4729,
    departureLon: 7.9408,
    federalState: 'DE-BW',
    originAirports: overrides.originAirports ?? ['SXB'],
    childrenAges: [9],
    blackoutRanges: [],
  },
});

describe('Cross-border / neighbor-state departure discount', () => {
  it('applies when the home region is on holiday and the airport region is in school (Offenburg -> SXB)', () => {
    const res = optimizeVacationWindows(offenburg(), { 'DE-BW': BW, 'FR-GES': FR }, {});
    const at = (d: string) => res.find((w) => w.startDate === d && w.originAirport === 'SXB')!;
    // BW Whitsun, French schools in session
    expect(at('2027-05-19').isArbitrageOpportunity).toBe(true);
    // Early September: France back at school, BW still on holiday
    expect(at('2027-09-02').isArbitrageOpportunity).toBe(true);
    // August: both on holiday - no advantage
    expect(at('2027-08-09').isArbitrageOpportunity).toBe(false);
  });

  it('gives no discount outside the home holidays (the home airports are just as cheap then)', () => {
    const res = optimizeVacationWindows(offenburg(), { 'DE-BW': BW, 'FR-GES': FR }, {});
    const june = res.filter((w) => w.startDate >= '2027-06-05' && w.startDate <= '2027-06-25');
    expect(june.length).toBeGreaterThan(0);
    expect(june.every((w) => !w.isArbitrageOpportunity)).toBe(true);
  });

  it('gives no discount when the airport region has no school calendar (unknown is not "in session")', () => {
    const res = optimizeVacationWindows(offenburg(), { 'DE-BW': BW }, {});
    expect(res.some((w) => w.isArbitrageOpportunity)).toBe(false);
  });

  it('scores the drive to a selected airport (same airport, longer drive = more friction)', () => {
    const run = (lat: number, lon: number) =>
      optimizeVacationWindows(
        {
          ...offenburg({ originAirports: ['ZRH'] }),
          earliestDate: '2027-06-01',
          latestDate: '2027-06-07',
          userProfile: { ...offenburg({ originAirports: ['ZRH'] }).userProfile, departureLat: lat, departureLon: lon },
        },
        {},
        {}
      )[0];
    const fromOffenburg = run(48.4729, 7.9408); // ~120 km to Zurich
    const fromKarlsruhe = run(49.0069, 8.4037); // ~175 km to Zurich
    expect(fromOffenburg.originAirport).toBe('ZRH');
    expect(fromOffenburg.scoreBreakdown!.travelFrictionIndex).toBeGreaterThan(fromKarlsruhe.scoreBreakdown!.travelFrictionIndex);
  });

  it('keeps the cross-border airport next door in the flexible airport search', () => {
    const flex = resolveFlexOriginAirports(48.4729, 7.9408);
    expect(flex.slice(0, 2)).toEqual(['SXB', 'FKB']);
    // Basel-Mulhouse ranks by its route network, not by patchy passenger figures
    expect(flex).toContain('BSL');
    expect(resolveFlexOriginAirports(50.776, 6.084).slice(0, 2)).toEqual(['MST', 'LGG']); // Aachen
  });
});

describe('Departure-region school calendars', () => {
  it('maps ISO codes to OpenHolidays subdivision codes', () => {
    expect(toOpenHolidaysSubdivision('FR-GES')).toBe('FR-GE');
    expect(toOpenHolidaysSubdivision('AT-5')).toBe('AT-SB');
    expect(toOpenHolidaysSubdivision('DE-BW')).toBe('DE-BW');
  });

  it('uses a typical calendar only when estimates are allowed (departure airports)', async () => {
    // OpenHolidays is mocked empty in unit tests
    expect(await getSchoolHolidays('FR-GES', 2027)).toEqual([]);
    const estimated = await getSchoolHolidays('FR-GES', 2027, { allowEstimates: true });
    expect(estimated.length).toBeGreaterThan(0);
    expect(estimated.every((h) => h.name.includes('estimate'))).toBe(true);
    // No typical pattern for the country: stays honest
    expect(await getSchoolHolidays('DK-84', 2027, { allowEstimates: true })).toEqual([]);
  });
});
