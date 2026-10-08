import { describe, it, expect } from 'vitest';
import {
  optimizeVacationWindows,
  overlapsWithBlackout,
  isWithinSchoolHoliday,
  normalizeScore,
} from './engine';
import { calculatePtoDaysConsumed } from './pto-calculator';
import { getChildAgeTier, parseChildrenAges, calculatePassengerCostMultiplier } from './child-tiers';
import { isArbitrageAirport, calculateDistanceKm } from './arbitrage';
import { getEstimatedClimate } from './weather';
import { TripPlanInput, SchoolHoliday, PublicHoliday } from './types';

describe('CSP Optimizer - Edge Cases & Core Engine', () => {
  const mockSchoolHolidaysBW: SchoolHoliday[] = [
    {
      startDate: '2026-07-30',
      endDate: '2026-09-12',
      name: 'Sommerferien BW',
      state: 'DE-BW',
    },
    {
      startDate: '2026-05-25',
      endDate: '2026-06-05',
      name: 'Pfingstferien BW',
      state: 'DE-BW',
    },
  ];

  const mockSchoolHolidaysBY: SchoolHoliday[] = [
    {
      startDate: '2026-08-03',
      endDate: '2026-09-14',
      name: 'Sommerferien BY',
      state: 'DE-BY',
    },
  ];

  const mockSchoolHolidaysHE: SchoolHoliday[] = [
    {
      startDate: '2026-06-29',
      endDate: '2026-08-07',
      name: 'Sommerferien HE',
      state: 'DE-HE',
    },
  ];

  const mockPublicHolidaysBW: PublicHoliday[] = [
    { date: '2026-05-14', name: 'Christi Himmelfahrt', state: 'DE-BW' },
    { date: '2026-05-25', name: 'Pfingstmontag', state: 'DE-BW' },
    { date: '2026-06-04', name: 'Fronleichnam', state: 'DE-BW' },
  ];

  it('correctly calculates age tiers and multiplier', () => {
    expect(getChildAgeTier(1)).toBe('infant');
    expect(getChildAgeTier(6)).toBe('child');
    expect(getChildAgeTier(11)).toBe('child');
    expect(getChildAgeTier(12)).toBe('teen');
    expect(getChildAgeTier(16)).toBe('teen');

    const parsed = parseChildrenAges([1, 8, 15]);
    expect(parsed[0].tier).toBe('infant');
    expect(parsed[1].tier).toBe('child');
    expect(parsed[2].tier).toBe('teen');

    // 2 adults (2.0) + infant (0.10) + child (0.75) + teen (1.0) = 3.85
    const multiplier = calculatePassengerCostMultiplier(2, [1, 7, 14]);
    expect(multiplier).toBeCloseTo(3.85, 2);
  });

  it('detects blackout overlaps accurately', () => {
    const blackouts = [
      { startDate: '2026-08-10', endDate: '2026-08-15' },
    ];

    expect(overlapsWithBlackout('2026-08-01', '2026-08-09', blackouts)).toBe(false);
    expect(overlapsWithBlackout('2026-08-16', '2026-08-25', blackouts)).toBe(false);
    expect(overlapsWithBlackout('2026-08-05', '2026-08-12', blackouts)).toBe(true);
    expect(overlapsWithBlackout('2026-08-10', '2026-08-14', blackouts)).toBe(true);
    expect(overlapsWithBlackout('2026-08-15', '2026-08-20', blackouts)).toBe(true);
  });

  it('verifies candidate window must be entirely within school holidays for school kids', () => {
    // Holiday: 2026-07-30 to 2026-09-12
    expect(isWithinSchoolHoliday('2026-08-01', '2026-08-10', mockSchoolHolidaysBW)).toBe(true);
    expect(isWithinSchoolHoliday('2026-07-28', '2026-08-05', mockSchoolHolidaysBW)).toBe(false);
    expect(isWithinSchoolHoliday('2026-09-10', '2026-09-15', mockSchoolHolidaysBW)).toBe(false);
  });

  it('calculates PTO days consumed and bridge days correctly', () => {
    const ptoRes = calculatePtoDaysConsumed('2026-05-23', '2026-05-31', mockPublicHolidaysBW);
    expect(ptoRes.totalWeekdays).toBe(5);
    expect(ptoRes.publicHolidaysCount).toBe(1);
    expect(ptoRes.ptoDaysConsumed).toBe(4);
  });

  it('detects arbitrage opportunity across state borders and handles unknown airports', () => {
    expect(isArbitrageAirport('DE-BW', 'FRA')).toBe(true);
    expect(isArbitrageAirport('DE-BW', 'STR')).toBe(false);
    expect(isArbitrageAirport('DE-BW', 'BSL')).toBe(true);
    expect(isArbitrageAirport('DE-BW', 'UNKNOWN')).toBe(false);

    const dist = calculateDistanceKm(48.6899, 9.2220, 50.0379, 8.5622); // STR to FRA
    expect(dist).toBeGreaterThan(140);
    expect(dist).toBeLessThan(180);
  });

  it('evaluates weather across various seasons and destination types', () => {
    // Summer beach (PMI in July, month 6)
    const summerBeach = getEstimatedClimate('PMI', 6);
    expect(summerBeach.isSuitable).toBe(true);
    expect(summerBeach.avgTempC).toBeGreaterThanOrEqual(25);

    // Winter ski (INN in January, month 0)
    const winterSki = getEstimatedClimate('INN', 0);
    expect(winterSki.isSuitable).toBe(true);
    expect(winterSki.avgTempC).toBeLessThanOrEqual(5);

    // Summer ski (INN in July, month 6) -> Should be unsuitable for skiing
    const summerSki = getEstimatedClimate('INN', 6);
    expect(summerSki.isSuitable).toBe(false);

    // Winter beach (PMI in January, month 0) -> Cold for beach
    const winterBeach = getEstimatedClimate('PMI', 0);
    expect(winterBeach.isSuitable).toBe(false);

    // Spring city (BCN in April, month 3)
    const springCity = getEstimatedClimate('BCN', 3);
    expect(springCity.isSuitable).toBe(true);

    // Unknown destination fallback
    const unknownDest = getEstimatedClimate('XYZ', 6);
    expect(unknownDest.isSuitable).toBe(true);
  });

  it('optimizes vacation windows and produces ranked candidates with arbitrage detection', () => {
    const input: TripPlanInput = {
      destinationType: 'BEACH',
      targetRegion: 'PMI',
      durationDays: 7,
      earliestDate: '2026-08-01',
      latestDate: '2026-08-25',
      maxBudgetTotal: 5000,
      userProfile: {
        homeLocation: '70173 Stuttgart',
        federalState: 'DE-BW',
        originAirports: ['STR', 'FRA'],
        childrenAges: [7, 10], // School children
        blackoutRanges: [
          { startDate: '2026-08-10', endDate: '2026-08-15', reason: 'Work deadline' },
        ],
      },
    };

    const schoolHolidays = {
      'DE-BW': mockSchoolHolidaysBW,
      'DE-HE': mockSchoolHolidaysHE, // Hessen school holiday ends 2026-08-07!
      'DE-BY': mockSchoolHolidaysBY,
    };

    const publicHolidays = {
      'DE-BW': mockPublicHolidaysBW,
    };

    const results = optimizeVacationWindows(input, schoolHolidays, publicHolidays);

    expect(results.length).toBeGreaterThan(0);

    // Verify all candidates respect blackout dates
    results.forEach((w) => {
      expect(overlapsWithBlackout(w.startDate, w.endDate, input.userProfile.blackoutRanges)).toBe(false);
    });

    // Check for arbitrage candidate: Hessen (FRA) school is back in session after Aug 7, while BW is still on holiday
    const arbitrageCandidates = results.filter((w) => w.isArbitrageOpportunity);
    expect(arbitrageCandidates.length).toBeGreaterThan(0);
    expect(arbitrageCandidates[0].arbitrageOriginState).toBe('DE-HE');
    expect(arbitrageCandidates[0].originAirport).toBe('FRA');

    // Verify score is within [0, 100]
    results.forEach((w) => {
      expect(w.finalScore).toBeGreaterThanOrEqual(0);
      expect(w.finalScore).toBeLessThanOrEqual(100);
      expect(w.scoreBreakdown.priceIndex).toBeGreaterThanOrEqual(0);
    });

    // Results should be sorted descending by finalScore
    for (let i = 0; i < results.length - 1; i++) {
      expect(results[i].finalScore).toBeGreaterThanOrEqual(results[i + 1].finalScore);
    }
  });

  it('handles vacation search with toddlers/infants (no school constraints)', () => {
    const input: TripPlanInput = {
      destinationType: 'BEACH',
      durationDays: 7,
      earliestDate: '2026-06-01',
      latestDate: '2026-06-15',
      userProfile: {
        homeLocation: 'Stuttgart',
        federalState: 'DE-BW',
        originAirports: [], // default to STR, FRA
        childrenAges: [1], // Infant only, not school kids
        blackoutRanges: [],
      },
    };

    const results = optimizeVacationWindows(input, {}, {});
    expect(results.length).toBeGreaterThan(0);
  });

  it('handles leap year intervals seamlessly', () => {
    const ptoRes = calculatePtoDaysConsumed('2028-02-26', '2028-03-02', []);
    expect(ptoRes.totalWeekdays).toBe(4);
  });

  it('returns empty list gracefully if impossible constraints (all dates blacked out)', () => {
    const input: TripPlanInput = {
      destinationType: 'BEACH',
      durationDays: 7,
      earliestDate: '2026-08-01',
      latestDate: '2026-08-10',
      userProfile: {
        homeLocation: 'Stuttgart',
        federalState: 'DE-BW',
        originAirports: ['STR'],
        childrenAges: [7],
        blackoutRanges: [
          { startDate: '2026-08-01', endDate: '2026-08-10' },
        ],
      },
    };

    const results = optimizeVacationWindows(input, { 'DE-BW': mockSchoolHolidaysBW }, {});
    expect(results).toHaveLength(0);
  });

  it('filters out windows exceeding maxBudgetTotal', () => {
    const input: TripPlanInput = {
      destinationType: 'BEACH',
      durationDays: 7,
      earliestDate: '2026-08-01',
      latestDate: '2026-08-10',
      maxBudgetTotal: 100, // Impossibly low budget
      userProfile: {
        homeLocation: 'Stuttgart',
        federalState: 'DE-BW',
        originAirports: ['STR'],
        childrenAges: [7],
        blackoutRanges: [],
      },
    };

    const results = optimizeVacationWindows(input, { 'DE-BW': mockSchoolHolidaysBW }, {});
    expect(results).toHaveLength(0);
  });

  it('normalizes scores accurately across ranges', () => {
    expect(normalizeScore(50, 0, 100, true)).toBe(50);
    expect(normalizeScore(0, 0, 100, false)).toBe(100);
    expect(normalizeScore(100, 0, 100, false)).toBe(0);
    expect(normalizeScore(50, 50, 50, true)).toBe(80);
  });

  it('supports flexible durations and produces candidates across duration min to max', () => {
    const input: TripPlanInput = {
      destinationType: 'BEACH',
      durationDays: 7,
      durationDaysMin: 7,
      durationDaysMax: 8,
      earliestDate: '2026-08-01',
      latestDate: '2026-08-14',
      userProfile: {
        homeLocation: 'Stuttgart',
        federalState: 'DE-BW',
        originAirports: ['STR'],
        childrenAges: [8],
        blackoutRanges: [],
      },
    };

    const results = optimizeVacationWindows(input, { 'DE-BW': mockSchoolHolidaysBW }, {});
    expect(results.length).toBeGreaterThan(0);
    const durations = new Set(results.map((r) => r.durationDays));
    expect(durations.has(7)).toBe(true);
    expect(durations.has(8)).toBe(true);
  });

  it('merges profile blackouts and ad-hoc search blackouts', () => {
    const input: TripPlanInput = {
      destinationType: 'BEACH',
      durationDays: 7,
      earliestDate: '2026-08-01',
      latestDate: '2026-08-20',
      searchBlackouts: [
        { startDate: '2026-08-01', endDate: '2026-08-10', reason: 'Search blackout' },
      ],
      userProfile: {
        homeLocation: 'Stuttgart',
        federalState: 'DE-BW',
        originAirports: ['STR'],
        childrenAges: [8],
        blackoutRanges: [
          { startDate: '2026-08-11', endDate: '2026-08-20', reason: 'Profile blackout' },
        ],
      },
    };

    const results = optimizeVacationWindows(input, { 'DE-BW': mockSchoolHolidaysBW }, {});
    // All dates between 08-01 and 08-20 are blocked
    expect(results).toHaveLength(0);
  });
});

