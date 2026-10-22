import { describe, it, expect } from 'vitest';
import {
  optimizeVacationWindows,
  resolveChildSchoolCalendars,
  calculateCombinedHolidayCoverage,
} from '../engine';
import { appliesToSubdivision, getOfflinePublicHolidays } from '../../integrations/open-holidays';
import { resolveDateHolidaysRegion } from '../../holidays/date-holidays-cache';
import type { SchoolHoliday, TripPlanInput } from '../types';

// Synthetic summer breaks: BW starts Thu 29 Jul, BY starts Mon 2 Aug (weekend-expanded to Sat 31 Jul).
const SCHOOL: Record<string, SchoolHoliday[]> = {
  'DE-BW': [{ startDate: '2027-07-29', endDate: '2027-09-11', name: 'Sommerferien', state: 'DE-BW' }],
  'DE-BY': [{ startDate: '2027-08-02', endDate: '2027-09-13', name: 'Sommerferien', state: 'DE-BY' }],
};

const input = (childrenBirthDates: string[], childrenSchoolRegions?: (string | null)[]): TripPlanInput => ({
  targetDestinations: ['PMI'],
  durationDays: 10,
  earliestDate: '2027-07-30', // Friday: inside the BW break, before the BY break
  latestDate: '2027-08-08',
  travelVehicles: ['PLANE'],
  userProfile: {
    homeLocation: 'Stuttgart',
    federalState: 'DE-BW',
    originAirports: ['STR'],
    childrenAges: [],
    childrenBirthDates,
    childrenSchoolRegions,
    blackoutRanges: [],
  },
});

describe('Per-child school holiday regions', () => {
  it('a window inside the home break needs no exemption when every child follows the home calendar', () => {
    const windows = optimizeVacationWindows(input(['2017-03-01', '2019-05-01']), SCHOOL, {});
    expect(windows.length).toBeGreaterThan(0);
    expect(windows.every((w) => !w.requiresSchoolExemption)).toBe(true);
  });

  it('flags the same window when one child attends school in another state', () => {
    const windows = optimizeVacationWindows(input(['2017-03-01', '2019-05-01'], [null, 'DE-BY']), SCHOOL, {});
    expect(windows.length).toBeGreaterThan(0);
    expect(windows.every((w) => w.requiresSchoolExemption)).toBe(true);
  });

  it('ignores a region set on a child who is not of school age yet', () => {
    const windows = optimizeVacationWindows(input(['2017-03-01', '2024-05-01'], [null, 'DE-BY']), SCHOOL, {});
    expect(windows.every((w) => !w.requiresSchoolExemption)).toBe(true);
  });

  it('groups school-age children by calendar and drops regions without data', () => {
    const calendars = resolveChildSchoolCalendars(
      {
        homeLocation: '',
        federalState: 'DE-BW',
        originAirports: [],
        childrenAges: [],
        childrenBirthDates: ['2015-01-01', '2016-01-01', '2017-01-01'],
        childrenSchoolRegions: ['DE-BY', null, 'FR-IDF'],
        blackoutRanges: [],
      },
      'DE-BW',
      SCHOOL,
      '2027-07-01'
    );
    expect(calendars.map((c) => c.region).sort()).toEqual(['DE-BW', 'DE-BY']);
  });

  it('combined coverage is that of the least-covered calendar', () => {
    const calendars = [
      { region: 'DE-BW', holidays: SCHOOL['DE-BW'], childIndexes: [0] },
      { region: 'DE-BY', holidays: SCHOOL['DE-BY'], childIndexes: [1] },
    ];
    const cov = calculateCombinedHolidayCoverage('2027-07-30', '2027-08-08', calendars);
    expect(cov.isFullyInside).toBe(false);
    expect(cov.overlapDays).toBe(9); // BY (weekend-expanded) covers 31 Jul - 8 Aug
  });
});

describe('Regional public holidays', () => {
  it('only keeps OpenHolidays entries for the subdivision itself, its parents, or nationwide', () => {
    expect(appliesToSubdivision({ nationwide: true }, 'DE-BY')).toBe(true);
    expect(appliesToSubdivision({ nationwide: false, subdivisions: [{ code: 'DE-BY' }] }, 'DE-BY')).toBe(true);
    // Augsburg-only holiday must not shorten PTO for the whole of Bavaria
    expect(appliesToSubdivision({ nationwide: false, subdivisions: [{ code: 'DE-BY-AU' }] }, 'DE-BY')).toBe(false);
    // ...but does apply to a family registered in Augsburg itself
    expect(appliesToSubdivision({ nationwide: false, subdivisions: [{ code: 'DE-BY' }] }, 'DE-BY-AU')).toBe(true);
    expect(appliesToSubdivision({ nationwide: false, subdivisions: [{ code: 'DE-NW' }] }, 'DE-BY')).toBe(false);
  });

  it('offline fallback evaluates the regional rules of the state', () => {
    const bw = getOfflinePublicHolidays('DE-BW', 2027).map((h) => h.date);
    const be = getOfflinePublicHolidays('DE-BE', 2027).map((h) => h.date);
    expect(bw).toContain('2027-05-27'); // Corpus Christi (BW yes)
    expect(bw).toContain('2027-11-01'); // All Saints (BW yes)
    expect(be).not.toContain('2027-05-27'); // Berlin: no Corpus Christi
    expect(be).toContain('2027-03-08'); // Berlin: International Women's Day
    expect(bw).toContain('2027-10-03'); // nationwide
  });

  it('maps ISO 3166-2 codes onto date-holidays regions, falling back to the national calendar', () => {
    expect(resolveDateHolidaysRegion('DE-BW')).toEqual({ country: 'DE', state: 'BW' });
    expect(resolveDateHolidaysRegion('AT-9')).toEqual({ country: 'AT', state: '9' });
    expect(resolveDateHolidaysRegion('DE-XX')).toEqual({ country: 'DE' });
    expect(getOfflinePublicHolidays('LU', 2027).length).toBeGreaterThan(0);
  });
});
