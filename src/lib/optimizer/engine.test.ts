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
import { getEstimatedClimate, getDestinationSeasonalWarning } from './weather';
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

  it('strictly constrains results to user-selected destination and eliminates false positive fallbacks', () => {
    const input: TripPlanInput = {
      targetDestinations: ['Hurghada & Rotes Meer'],
      durationDays: 7,
      earliestDate: '2026-08-01',
      latestDate: '2026-08-20',
      userProfile: {
        homeLocation: 'Karlsruhe',
        federalState: 'DE-BW',
        originAirports: ['STR', 'FRA'],
        childrenAges: [7],
        blackoutRanges: [],
      },
    };

    const results = optimizeVacationWindows(input, { 'DE-BW': mockSchoolHolidaysBW }, {});
    expect(results.length).toBeGreaterThan(0);
    // Every single result MUST strictly be an airport belonging to the Red Sea (HRG, SSH, RMF)
    for (const r of results) {
      expect(['HRG', 'SSH', 'RMF']).toContain(r.destinationAirport);
      // Strictly verify no unrelated destinations leak into results
      expect(r.destinationAirport).not.toBe('PMI');
      expect(r.destinationAirport).not.toBe('AYT');
      expect(r.destinationAirport).not.toBe('HER');
    }
  });

  it('returns empty results instead of falling back to default hubs when unresolvable destinations are provided', () => {
    const input: TripPlanInput = {
      targetDestinations: ['FictitiousUnknownPlace'],
      durationDays: 7,
      earliestDate: '2026-08-01',
      latestDate: '2026-08-20',
      userProfile: {
        homeLocation: 'Karlsruhe',
        federalState: 'DE-BW',
        originAirports: ['STR'],
        childrenAges: [7],
        blackoutRanges: [],
      },
    };

    const results = optimizeVacationWindows(input, { 'DE-BW': mockSchoolHolidaysBW }, {});
    expect(results).toHaveLength(0);
  });
});

describe('Destination Validation & Entity Resolution', () => {
  it('strictly validates real destinations and rejects fictitious places like Mars', async () => {
    const { validateDestinationInput } = await import('./destinations');

    const validRedSea = await validateDestinationInput('Hurghada & Rotes Meer', 'de');
    expect(validRedSea.isValid).toBe(true);
    expect(validRedSea.category).toBe('region');
    expect(validRedSea.resolvedName).toBe('Hurghada & Rotes Meer');
    expect(validRedSea.airportCodes).toEqual(['HRG', 'SSH', 'RMF']);

    const validMallorca = await validateDestinationInput('Mallorca', 'de');
    expect(validMallorca.isValid).toBe(true);
    expect(validMallorca.resolvedName).toBe('Mallorca (Balearen)');
    expect(validMallorca.category).toBe('region');

    const validEgypt = await validateDestinationInput('Ägypten', 'de');
    expect(validEgypt.isValid).toBe(true);
    expect(validEgypt.category).toBe('country');

    const validDubai = await validateDestinationInput('Dubai', 'en');
    expect(validDubai.isValid).toBe(true);
    expect(validDubai.category).toBe('city');

    // Rejection of invalid / fictitious places
    const invalidMars = await validateDestinationInput('Mars', 'de');
    expect(invalidMars.isValid).toBe(false);

    const invalidAtlantis = await validateDestinationInput('Atlantis', 'en');
    expect(invalidAtlantis.isValid).toBe(false);
  });

  it('resolves destination codes strictly without unrequested fallback hubs', async () => {
    const { resolveDestinationCodes } = await import('./destinations');

    const redSeaCodes = resolveDestinationCodes(['Rotes Meer']);
    expect(redSeaCodes).toEqual(['HRG', 'SSH', 'RMF']);

    const mallorcaCodes = resolveDestinationCodes(['Mallorca']);
    expect(mallorcaCodes).toEqual(['PMI']);

    const unknownCodes = resolveDestinationCodes(['Mars']);
    expect(unknownCodes).toEqual([]);

    // Open discovery when no destinations are passed
    const defaultCodes = resolveDestinationCodes([]);
    expect(defaultCodes.length).toBeGreaterThan(0);
    expect(defaultCodes).toContain('PMI');
  });
});

describe('Dynamic Age Category Derivation & Segment-Aware Birthdays', () => {
  it('correctly categorizes infant, child, and adult tiers', async () => {
    const { deriveAgeCategory } = await import('./child-tiers');
    // Infant (< 2)
    expect(deriveAgeCategory('2025-05-10', '2026-08-01')).toBe('INFANT');
    // Child (2–11)
    expect(deriveAgeCategory('2020-05-10', '2026-08-01')).toBe('CHILD');
    // Adult (12+)
    expect(deriveAgeCategory('2010-05-10', '2026-08-01')).toBe('ADULT');
  });

  it('handles a child turning 2 during the trip (outbound infant, return child)', async () => {
    const { deriveSegmentAgeCategories, calculatePassengerCostMultiplier } = await import('./child-tiers');
    const birthDate = '2024-08-05';
    const outboundDate = '2026-08-01'; // age 1 -> INFANT
    const returnDate = '2026-08-10';   // turned 2 on Aug 5 -> CHILD

    const segmentTiers = deriveSegmentAgeCategories(birthDate, outboundDate, returnDate);
    expect(segmentTiers.outboundTier).toBe('INFANT');
    expect(segmentTiers.returnTier).toBe('CHILD');
    expect(segmentTiers.turnedTwoDuringTrip).toBe(true);

    // Multiplier: 2 adults (2.0) + average of infant (0.10) and child (0.75) = 2.0 + 0.425 = 2.425
    const multiplier = calculatePassengerCostMultiplier(2, [1], {
      birthDates: [birthDate],
      outboundDate,
      returnDate,
    });
    expect(multiplier).toBeCloseTo(2.425, 2);
  });
});

describe('PTO Calculation with Custom Workweeks & Adjacent Shifts', () => {
  it('calculates PTO correctly for non-Mon–Fri workweeks (e.g. Sunday–Thursday)', async () => {
    const { calculatePtoDaysConsumed } = await import('./pto-calculator');
    // Middle Eastern workweek: Sunday (0) to Thursday (4)
    const workweekSunThu = [0, 1, 2, 3, 4];
    
    // Sunday 2026-06-07 to Thursday 2026-06-11 (5 workdays)
    const result = calculatePtoDaysConsumed('2026-06-07', '2026-06-11', [], workweekSunThu);
    expect(result.totalWeekdays).toBe(5);
    expect(result.ptoDaysConsumed).toBe(5);

    // Friday 2026-06-12 to Saturday 2026-06-13 (weekend in Sun-Thu schedule)
    const weekendResult = calculatePtoDaysConsumed('2026-06-12', '2026-06-13', [], workweekSunThu);
    expect(weekendResult.totalWeekdays).toBe(0);
    expect(weekendResult.ptoDaysConsumed).toBe(0);
  });

  it('suggests adjacent shifts (±1–3 days) that save PTO via public holidays', async () => {
    const { suggestAdjacentPtoShifts } = await import('./pto-calculator');
    const publicHolidays: PublicHoliday[] = [
      { date: '2026-05-25', name: 'Pfingstmontag', state: 'DE-BW' }, // Monday
    ];

    // Starting on Tuesday 2026-05-26 to Friday 2026-05-29 (4 workdays PTO)
    // Shifting -1 day starts on Monday 2026-05-25 (Holiday!) to Thursday 2026-05-28 (3 workdays PTO -> saves 1 PTO day)
    const shifts = suggestAdjacentPtoShifts('2026-05-26', '2026-05-29', publicHolidays, [1, 2, 3, 4, 5], 4);
    expect(shifts.length).toBeGreaterThan(0);
    const minusOne = shifts.find((s) => s.shiftDays === -1);
    expect(minusOne).toBeDefined();
    expect(minusOne?.ptoSaved).toBeGreaterThanOrEqual(1);
  });
});

describe('Arbitrage Airport Info & Localized Seasonal Warnings', () => {
  it('resolves airport info dynamically via getOriginAirportInfo and SUPPORTED_ORIGIN_AIRPORTS', async () => {
    const { getOriginAirportInfo, SUPPORTED_ORIGIN_AIRPORTS } = await import('./arbitrage');
    const fra = getOriginAirportInfo('FRA');
    expect(fra).not.toBeNull();
    expect(fra?.code).toBe('FRA');
    expect(fra?.city.toLowerCase()).toContain('frankfurt');

    expect('FRA' in SUPPORTED_ORIGIN_AIRPORTS).toBe(true);
    expect(SUPPORTED_ORIGIN_AIRPORTS['FRA']?.code).toBe('FRA');

    expect(getOriginAirportInfo('XYZINVALID')).toBeNull();
    expect('XYZINVALID' in SUPPORTED_ORIGIN_AIRPORTS).toBe(false);
  });

  it('correctly localizes seasonal warnings across all enum types', async () => {
    const { getLocalizedSeasonalWarning } = await import('./localized-warnings');
    const { en } = await import('../i18n/locales/en');

    const monsoon = getLocalizedSeasonalWarning(
      { destinationCode: 'BKK', seasonType: 'MONSOON', monthRange: [6], messageKey: '', fallbackMessage: '' },
      en
    );
    expect(monsoon.title).toBe(en.home.seasonWarningMonsoonTitle);

    const heat = getLocalizedSeasonalWarning(
      { destinationCode: 'DXB', seasonType: 'EXTREME_HEAT', monthRange: [6], messageKey: '', fallbackMessage: '' },
      en
    );
    expect(heat.title).toBe(en.home.seasonWarningExtremeHeatTitle);

    const hurricane = getLocalizedSeasonalWarning(
      { destinationCode: 'CUN', seasonType: 'TYPHOON_HURRICANE', monthRange: [8], messageKey: '', fallbackMessage: '' },
      en
    );
    expect(hurricane.title).toBe(en.home.seasonWarningHurricaneTitle);

    const peak = getLocalizedSeasonalWarning(
      { destinationCode: 'HND', seasonType: 'OVERCROWDED_PEAK', monthRange: [3], messageKey: '', fallbackMessage: '' },
      en
    );
    expect(peak.title).toBe(en.home.seasonWarningCrowdedPeakTitle);

    const fallback = getLocalizedSeasonalWarning(
      { destinationCode: 'CUSTOM', seasonType: 'UNKNOWN' as any, monthRange: [], messageKey: '', fallbackMessage: 'Custom fallback' },
      en
    );
    expect(fallback.description).toBe('Custom fallback');
  });

  it('tests climate preferences (WARM, COOL, MODERATE) and holiday weekend expansions', async () => {
    const { expandSchoolHolidayWithWeekends, isWithinSchoolHoliday, normalizeScore } = await import('./engine');

    // normalizeScore edge case
    expect(normalizeScore(50, 50, 50)).toBe(80);

    // empty holidays returns true
    expect(isWithinSchoolHoliday('2026-06-01', '2026-06-08', [])).toBe(true);

    // expandSchoolHolidayWithWeekends
    // Holiday starting on Sunday
    const sunHol = expandSchoolHolidayWithWeekends({
      startDate: '2026-05-31', // Sunday
      endDate: '2026-06-05',   // Friday
      name: 'Test Hol',
      state: 'TEST',
    });
    expect(sunHol.startDate).toBe('2026-05-30'); // Saturday
    expect(sunHol.endDate).toBe('2026-06-07');   // Sunday

    // Winter ski in Alps (Innsbruck in January)
    const winterSki = getEstimatedClimate('INN', 0);
    expect(winterSki.isSuitable).toBe(true);
    expect(winterSki.avgTempC).toBeLessThanOrEqual(0);

    // Southern hemisphere (Sydney in January: midsummer)
    const sydSummer = getEstimatedClimate('SYD', 0, { lat: -33.86, lon: 151.2 });
    expect(sydSummer.avgTempC).toBeGreaterThanOrEqual(25);

    // Hurricane warning in Caribbean
    const cunWarning = getDestinationSeasonalWarning('CUN', 8);
    expect(cunWarning).not.toBeNull();
    expect(cunWarning?.seasonType).toBe('TYPHOON_HURRICANE');

    // Western Pacific typhoon warning
    const tpeWarning = getDestinationSeasonalWarning('TPE', 7);
    expect(tpeWarning).not.toBeNull();
    expect(tpeWarning?.seasonType).toBe('TYPHOON_HURRICANE');
  });
});



