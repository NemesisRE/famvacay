import { describe, it, expect } from 'vitest';
import {
  countryWeekend,
  defaultWorkweek,
  normalizeWorkweek,
  resolveWorkweek,
  sixDayVariants,
  workweekLabel,
} from '../workweek';
import { expandSchoolHolidayWithWeekends, optimizeVacationWindows } from '@/lib/optimizer/engine';
import { calculatePtoDaysConsumed } from '@/lib/optimizer/pto-calculator';
import { getFlightDayOfWeekMultiplier, getSynchronousTripPricing } from '@/lib/pricing/pricing-service';
import type { TripPlanInput } from '@/lib/optimizer/types';

describe('weekends and workweeks per country (CLDR week data)', () => {
  it('knows weekends that are not Saturday/Sunday', () => {
    expect(countryWeekend('DE')).toEqual([6, 7]);
    expect(countryWeekend('AU')).toEqual([6, 7]);
    expect(countryWeekend('SA')).toEqual([5, 6]);
    expect(countryWeekend('IL')).toEqual([5, 6]);
    expect(countryWeekend('IR')).toEqual([5]);
    expect(countryWeekend(undefined)).toEqual([6, 7]);
  });

  it('derives the usual workweek', () => {
    expect(defaultWorkweek('DE')).toEqual([1, 2, 3, 4, 5]);
    expect(defaultWorkweek('SA')).toEqual([1, 2, 3, 4, 7]);
    expect(defaultWorkweek('IR')).toEqual([1, 2, 3, 4, 6, 7]);
  });

  it('prefers the family own workdays and accepts JS Sunday = 0', () => {
    expect(resolveWorkweek([0, 1, 2, 3, 4], 'DE')).toEqual([1, 2, 3, 4, 7]);
    expect(resolveWorkweek([], 'SA')).toEqual([1, 2, 3, 4, 7]);
    expect(normalizeWorkweek([9, 'x'])).toBeNull();
  });

  it('offers Monday-Saturday where Sunday is off, both six-day weeks where the weekend is Friday/Saturday', () => {
    expect(sixDayVariants([1, 2, 3, 4, 5])).toEqual([[1, 2, 3, 4, 5, 6]]);
    expect(sixDayVariants([1, 2, 3, 4, 7])).toEqual([
      [1, 2, 3, 4, 5, 7],
      [1, 2, 3, 4, 6, 7],
    ]);
    expect(sixDayVariants([1, 2, 3, 4, 6, 7])).toEqual([]);
  });

  it('labels weeks across the end of the ISO week', () => {
    expect(workweekLabel([1, 2, 3, 4, 5], 'en')).toBe('Mon–Fri');
    expect(workweekLabel([1, 2, 3, 4, 7], 'en')).toBe('Sun–Thu');
    expect(workweekLabel([1, 2, 3, 4, 6, 7], 'de')).toBe('Sa–Do');
    expect(workweekLabel([1, 3, 5], 'en')).toBe('Mon, Wed, Fri');
  });
});

describe('school breaks extend over the weekend of their own country', () => {
  it('Saudi Arabia: a Sunday-Thursday break includes the Friday/Saturday around it', () => {
    // Sunday 2026-10-04 to Thursday 2026-10-15
    expect(expandSchoolHolidayWithWeekends({ startDate: '2026-10-04', endDate: '2026-10-15', name: 'Break', state: 'SA-01' })).toEqual({
      startDate: '2026-10-02',
      endDate: '2026-10-17',
    });
  });

  it('Germany: the same dates bridge to Saturday/Sunday', () => {
    expect(expandSchoolHolidayWithWeekends({ startDate: '2026-10-04', endDate: '2026-10-15', name: 'Break', state: 'DE-BW' })).toEqual({
      startDate: '2026-10-03',
      endDate: '2026-10-18',
    });
  });
});

describe('PTO with a Sunday-Thursday week', () => {
  it('a public holiday on a Friday saves nothing in Saudi Arabia, a day in Germany', () => {
    const holidays = [{ date: '2026-10-09', name: 'Holiday' }]; // a Friday
    const saudi = calculatePtoDaysConsumed('2026-10-04', '2026-10-10', holidays, defaultWorkweek('SA'));
    const german = calculatePtoDaysConsumed('2026-10-04', '2026-10-10', holidays, defaultWorkweek('DE'));
    expect(saudi).toMatchObject({ totalWeekdays: 5, publicHolidaysCount: 0, ptoDaysConsumed: 5 });
    expect(german).toMatchObject({ totalWeekdays: 5, publicHolidaysCount: 1, ptoDaysConsumed: 4 });
  });

  it('the engine counts a Saudi family with Sunday-Thursday and both six-day weeks', () => {
    const input: TripPlanInput = {
      targetRegion: 'DXB',
      durationDays: 7,
      earliestDate: '2026-10-04',
      latestDate: '2026-10-20',
      userProfile: {
        homeLocation: 'Riyadh',
        federalState: 'SA-01',
        originAirports: ['RUH'],
        childrenAges: [3],
        blackoutRanges: [],
      },
    };
    const results = optimizeVacationWindows(input, {}, {});
    expect(results.length).toBeGreaterThan(0);
    for (const w of results) {
      expect(w.workweekDays).toEqual([1, 2, 3, 4, 7]);
      expect(w.workweekVariants?.map((v) => v.days)).toEqual([
        [1, 2, 3, 4, 5, 7],
        [1, 2, 3, 4, 6, 7],
      ]);
    }
  });
});

describe('prices follow local weekends', () => {
  it('flight peaks move with the travellers weekend', () => {
    // A Thursday before a Friday/Saturday weekend is what a Friday is before Saturday/Sunday
    expect(getFlightDayOfWeekMultiplier('2026-07-02', [5, 6])).toBe(getFlightDayOfWeekMultiplier('2026-07-03'));
    expect(getFlightDayOfWeekMultiplier('2026-07-03', [5, 6])).toBe(getFlightDayOfWeekMultiplier('2026-07-04'));
  });

  it('hotel weekend nights are the nights before the destination weekend', () => {
    const lodging = (dest: string, startDate: string, endDate: string) =>
      getSynchronousTripPricing({
        originAirport: 'FRA',
        destinationAirport: dest,
        startDate,
        endDate,
        durationDays: 4,
        party: { adults: 2, childrenAges: [] },
      }).lodging.totalLodgingCost;
    // Doha (Friday/Saturday weekend): Wednesday-Saturday has two weekend nights, Saturday-Tuesday none
    expect(lodging('DOH', '2026-10-14', '2026-10-17')).toBeGreaterThan(lodging('DOH', '2026-10-17', '2026-10-20'));
    // Palma (Saturday/Sunday weekend): one weekend night in each
    expect(lodging('PMI', '2026-10-14', '2026-10-17')).toBe(lodging('PMI', '2026-10-17', '2026-10-20'));
  });
});
