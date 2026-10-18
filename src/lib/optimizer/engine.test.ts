import { describe, it, expect } from 'vitest';
import {
  optimizeVacationWindows,
  overlapsWithBlackout,
  isWithinSchoolHoliday,
  normalizeScore,
  interleaveCandidateWindowsByDestination,
  calculateFlightFrictionScore,
  curateDistinctAlternativeWindows,
} from './engine';
import { getSynchronousTripPricing } from '../pricing/pricing-service';
import { calculatePtoDaysConsumed } from './pto-calculator';
import { getChildAgeTier, parseChildrenAges, calculatePassengerCostMultiplier } from './child-tiers';
import { isArbitrageAirport, calculateDistanceKm } from './arbitrage';
import { getEstimatedClimate, getDestinationSeasonalWarning } from './weather';
import { TripPlanInput, SchoolHoliday, PublicHoliday, CandidateWindow } from './types';
import { getDestinationVacationStyles } from './destinations';

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

describe('CSP Optimizer - Edge Cases & Core Engine', () => {

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

  it('correctly uses the configured number of adults in vacation cost estimation', () => {
    const baseInput = {
      targetDestinations: ['Mallorca'],
      durationDays: 7,
      earliestDate: '2026-08-01',
      latestDate: '2026-08-08',
      userProfile: {
        homeLocation: 'Stuttgart',
        federalState: 'DE-BW',
        originAirports: ['STR'],
        childrenAges: [7],
        blackoutRanges: [],
      },
    };

    const res1Adult = optimizeVacationWindows({
      ...baseInput,
      userProfile: { ...baseInput.userProfile, adults: 1 },
    }, { 'DE-BW': mockSchoolHolidaysBW }, {});

    const res2Adults = optimizeVacationWindows({
      ...baseInput,
      userProfile: { ...baseInput.userProfile, adults: 2 },
    }, { 'DE-BW': mockSchoolHolidaysBW }, {});

    const res3Adults = optimizeVacationWindows({
      ...baseInput,
      userProfile: { ...baseInput.userProfile, adults: 3 },
    }, { 'DE-BW': mockSchoolHolidaysBW }, {});

    expect(res1Adult.length).toBeGreaterThan(0);
    expect(res2Adults.length).toBeGreaterThan(0);
    expect(res3Adults.length).toBeGreaterThan(0);

    // 1 adult should cost less than 2 adults, which costs less than 3 adults
    expect(res1Adult[0].estimatedTotalCost).toBeLessThan(res2Adults[0].estimatedTotalCost);
    expect(res2Adults[0].estimatedTotalCost).toBeLessThan(res3Adults[0].estimatedTotalCost);

    // Verify party composition in pricing details
    expect(res1Adult[0].pricingDetails?.party?.adults).toBe(1);
    expect(res2Adults[0].pricingDetails?.party?.adults).toBe(2);
    expect(res3Adults[0].pricingDetails?.party?.adults).toBe(3);
  });

  it('interleaves candidate windows so distinct destinations are presented on page 1', () => {
    // Mock candidate windows for 3 destinations
    const makeCand = (dest: string, score: number, id: string): any => ({
      destinationAirport: dest,
      finalScore: score,
      startDate: '2026-08-01',
      endDate: '2026-08-08',
      durationDays: 7,
      originAirport: 'STR',
      estimatedTotalCost: 1000,
      ptoDaysConsumed: 5,
    });

    const mockWindows = [
      makeCand('HRG', 95, 'h1'),
      makeCand('HRG', 94, 'h2'),
      makeCand('HRG', 93, 'h3'),
      makeCand('INN', 92, 'i1'),
      makeCand('INN', 91, 'i2'),
      makeCand('BCN', 90, 'b1'),
      makeCand('BCN', 89, 'b2'),
    ];

    const interleaved = interleaveCandidateWindowsByDestination(mockWindows);
    // Round 0: HRG (95), INN (92), BCN (90)
    expect(interleaved[0].destinationAirport).toBe('HRG');
    expect(interleaved[1].destinationAirport).toBe('INN');
    expect(interleaved[2].destinationAirport).toBe('BCN');
    // Round 1: HRG (94), INN (91), BCN (89)
    expect(interleaved[3].destinationAirport).toBe('HRG');
    expect(interleaved[4].destinationAirport).toBe('INN');
    expect(interleaved[5].destinationAirport).toBe('BCN');
    // Round 2: HRG (93)
    expect(interleaved[6].destinationAirport).toBe('HRG');
  });

  it('optimizes for ALPINE vacation style and yields alpine destination windows', () => {
    const input: TripPlanInput = {
      destinationType: 'ALPINE',
      durationDays: 7,
      earliestDate: '2026-08-01',
      latestDate: '2026-08-15',
      userProfile: {
        homeLocation: 'Stuttgart',
        federalState: 'DE-BW',
        originAirports: ['STR', 'FRA'],
        childrenAges: [7],
        blackoutRanges: [],
      },
    };

    const results = optimizeVacationWindows(input, { 'DE-BW': mockSchoolHolidaysBW }, {});
    expect(results.length).toBeGreaterThan(0);

    // All results must be from the Alpine portfolio
    const destinationsFound = new Set(results.map((r) => r.destinationAirport));
    expect(destinationsFound.has('INN') || destinationsFound.has('SZG') || destinationsFound.has('GVA')).toBe(true);
    expect(destinationsFound.has('HRG')).toBe(false);
  });

  it('provides diverse destinations across the first 10 results in open discovery', () => {
    const input: TripPlanInput = {
      destinationType: 'ALL',
      durationDays: 7,
      earliestDate: '2026-08-01',
      latestDate: '2026-08-15',
      userProfile: {
        homeLocation: 'Stuttgart',
        federalState: 'DE-BW',
        originAirports: ['STR', 'FRA'],
        childrenAges: [7],
        blackoutRanges: [],
      },
    };

    const results = optimizeVacationWindows(input, { 'DE-BW': mockSchoolHolidaysBW }, {});
    expect(results.length).toBeGreaterThanOrEqual(5);

    // First 10 results (Page 1) must showcase multiple distinct destinations
    const page1Destinations = new Set(results.slice(0, 10).map((r) => r.destinationAirport));
    expect(page1Destinations.size).toBeGreaterThanOrEqual(3);
  });

  it('retains candidate windows across multiple months during open discovery with school kids', () => {
    // Range spanning from outside holiday (early July) into Sommerferien (Aug)
    const input: TripPlanInput = {
      destinationType: 'BEACH',
      durationDays: 7,
      earliestDate: '2026-07-01',
      latestDate: '2026-08-15',
      userProfile: {
        homeLocation: 'Stuttgart',
        federalState: 'DE-BW',
        originAirports: ['STR'],
        childrenAges: [7], // School kid
        blackoutRanges: [],
      },
    };

    // Sommerferien BW: 2026-07-30 to 2026-09-12
    const resultsOpen = optimizeVacationWindows(input, { 'DE-BW': mockSchoolHolidaysBW }, {});
    expect(resultsOpen.length).toBeGreaterThan(0);

    // Should include early July dates (outside holidays with exemption flag) and August dates (inside holidays)
    const earlyJulyWindows = resultsOpen.filter((w) => w.startDate < '2026-07-20');
    const augWindows = resultsOpen.filter((w) => w.startDate.startsWith('2026-08'));
    expect(earlyJulyWindows.length).toBeGreaterThan(0);
    expect(augWindows.length).toBeGreaterThan(0);

    // Early July windows should be marked with requiresSchoolExemption: true
    expect(earlyJulyWindows[0].requiresSchoolExemption).toBe(true);
    // Aug windows should be false
    expect(augWindows[0].requiresSchoolExemption).toBe(false);

    // Now test with strictSchoolHolidays: true
    const resultsStrict = optimizeVacationWindows(
      { ...input, strictSchoolHolidays: true },
      { 'DE-BW': mockSchoolHolidaysBW },
      {}
    );
    expect(resultsStrict.length).toBeGreaterThan(0);
    // Under strict mode, NO July windows before July 30 should exist
    const strictEarlyJuly = resultsStrict.filter((w) => w.startDate < '2026-07-30');
    expect(strictEarlyJuly).toHaveLength(0);
  });

  it('calculates flight friction score based on flight corridor distance', () => {
    // Short hop (Miami -> Bahamas, ~290 km): friction score is very high (> 95)
    expect(calculateFlightFrictionScore(290)).toBeGreaterThanOrEqual(95);

    // Regional mid-haul (Miami -> Punta Cana, ~1460 km): friction score ~90
    expect(calculateFlightFrictionScore(1460)).toBeGreaterThanOrEqual(88);

    // Transatlantic long-haul (Miami -> Innsbruck, ~8000 km): friction score is low without LONGRANGE
    expect(calculateFlightFrictionScore(8000, false)).toBeLessThanOrEqual(50);

    // Transatlantic with LONGRANGE opt-in: friction penalty is mitigated
    expect(calculateFlightFrictionScore(8000, true)).toBeGreaterThanOrEqual(65);
  });

  it('eliminates European bias for American departures (Miami yields Bahamas and Dominican Republic at top)', () => {
    const input: TripPlanInput = {
      durationDays: 7,
      earliestDate: '2026-11-01',
      latestDate: '2026-11-15',
      userProfile: {
        homeLocation: 'Miami, Florida',
        departureLat: 25.7617,
        departureLon: -80.1918,
        federalState: 'US-FL',
        originAirports: ['MIA'],
        childrenAges: [],
        blackoutRanges: [],
      },
    };

    const results = optimizeVacationWindows(input, {}, {});
    expect(results.length).toBeGreaterThan(0);

    // Top results must feature Caribbean / Regional Americas destinations
    const topDestinations = results.slice(0, 20).map((r) => r.destinationAirport);
    expect(topDestinations).toContain('NAS'); // Bahamas
    expect(topDestinations).toContain('PUJ'); // Dominican Republic
    expect(topDestinations).toContain('MBJ'); // Jamaica
    expect(topDestinations).toContain('CUN'); // Cancun

    // European destinations like Innsbruck (INN) or Tenerife (TFS) must NOT be ahead of close Caribbean hubs
    expect(topDestinations).not.toContain('INN');
    expect(topDestinations).not.toContain('TFS');

    // Friction score for top Caribbean results must be high (>= 90)
    const nasWindow = results.find((r) => r.destinationAirport === 'NAS');
    expect(nasWindow?.scoreBreakdown.travelFrictionIndex).toBeGreaterThanOrEqual(90);

    const pujWindow = results.find((r) => r.destinationAirport === 'PUJ');
    expect(pujWindow?.scoreBreakdown.travelFrictionIndex).toBeGreaterThanOrEqual(90);
  });

  it('optimizes Caribbean vacation search for adults from Karlsruhe without hardcoding', () => {
    const input: TripPlanInput = {
      targetDestinations: ['Caribbean'],
      durationDays: 10,
      earliestDate: '2026-11-01',
      latestDate: '2026-12-15',
      durationDaysMin: 10,
      durationDaysMax: 10,
      userProfile: {
        homeLocation: 'Karlsruhe',
        departureLat: 49.0069,
        departureLon: 8.4037,
        federalState: 'DE-BW',
        originAirports: ['FKB', 'STR', 'FRA'],
        adults: 2,
        childrenAges: [],
        blackoutRanges: [],
      },
    };

    const results = optimizeVacationWindows(input, {}, {});
    expect(results.length).toBeGreaterThan(0);

    const foundDestinations = Array.from(new Set(results.map((r) => r.destinationAirport)));
    // Must feature Caribbean vacation hubs
    expect(
      foundDestinations.some((code) => ['PUJ', 'CUN', 'NAS', 'MBJ', 'SDQ', 'SJU', 'GCM', 'AUA', 'CUR', 'KIN'].includes(code))
    ).toBe(true);

    // Weather index must reflect high comfort for Caribbean in winter season
    const firstWin = results[0];
    expect(firstWin.weather.avgTempC).toBeGreaterThanOrEqual(22);
    expect(firstWin.finalScore).toBeGreaterThan(60);
  });

  it('resolves destination categories dynamically when destinations are defined without manual style', () => {
    // 1. Alpine destination: Innsbruck (INN)
    const alpineInput: TripPlanInput = {
      targetDestinations: ['Innsbruck'],
      durationDays: 7,
      earliestDate: '2026-12-01',
      latestDate: '2026-12-31',
      durationDaysMin: 7,
      durationDaysMax: 7,
      userProfile: {
        homeLocation: 'Karlsruhe',
        departureLat: 49.0069,
        departureLon: 8.4037,
        federalState: 'DE-BW',
        originAirports: ['FRA'],
        adults: 2,
        childrenAges: [],
        blackoutRanges: [],
      },
    };

    const alpineResults = optimizeVacationWindows(alpineInput, {}, {});
    expect(alpineResults.length).toBeGreaterThan(0);
    // Innsbruck in December is dynamically analyzed as SKI/ALPINE, resulting in high weather index for winter temperatures
    expect(alpineResults[0].scoreBreakdown.weatherIndex).toBeGreaterThanOrEqual(60);

    // 2. Beach destination: Mallorca (PMI)
    const beachInput: TripPlanInput = {
      targetDestinations: ['Mallorca'],
      durationDays: 7,
      earliestDate: '2026-06-01',
      latestDate: '2026-06-30',
      durationDaysMin: 7,
      durationDaysMax: 7,
      userProfile: {
        homeLocation: 'Karlsruhe',
        departureLat: 49.0069,
        departureLon: 8.4037,
        federalState: 'DE-BW',
        originAirports: ['FRA'],
        adults: 2,
        childrenAges: [],
        blackoutRanges: [],
      },
    };

    const beachResults = optimizeVacationWindows(beachInput, {}, {});
    expect(beachResults.length).toBeGreaterThan(0);
    // Mallorca in June is dynamically analyzed as BEACH, resulting in high weather index for summer temperatures
    expect(beachResults[0].scoreBreakdown.weatherIndex).toBeGreaterThanOrEqual(80);
  });

  describe('Alternative Dates Curation & Airline Day-of-Week Pricing', () => {
    it('curates distinct alternative dates eliminating redundant +1 day shifts and caps at maxAlternatives', () => {
      // Simulate raw candidate windows with repetitive daily shifts across 2 origins
      const mockWindows: CandidateWindow[] = [];
      const baseDate = new Date('2026-11-01');

      for (let day = 0; day < 30; day++) {
        const d1 = new Date(baseDate.getTime() + day * 86400000).toISOString().split('T')[0];
        const d2 = new Date(baseDate.getTime() + (day + 10) * 86400000).toISOString().split('T')[0];

        // Origin 1: FKB
        mockWindows.push({
          startDate: d1,
          endDate: d2,
          durationDays: 10,
          originAirport: 'FKB',
          destinationAirport: 'PUJ',
          destinationName: 'Punta Cana',
          destinationCity: 'Punta Cana',
          destinationCountry: 'Dominican Republic',
          estimatedTotalCost: 2200 + day * 10,
          pricePerPerson: 1100,
          ptoDaysConsumed: 6 + (day % 3),
          ptoEfficiencyRatio: 1.6,
          publicHolidaysCount: day === 5 ? 2 : 0,
          requiresSchoolExemption: false,
          isArbitrageOpportunity: false,
          finalScore: 85 - (day % 10),
          scoreBreakdown: { priceIndex: 80, weatherIndex: 90, ptoEfficiencyIndex: 75, travelFrictionIndex: 85 },
        } as CandidateWindow);

        // Origin 2: FRA
        mockWindows.push({
          startDate: d1,
          endDate: d2,
          durationDays: 10,
          originAirport: 'FRA',
          destinationAirport: 'PUJ',
          destinationName: 'Punta Cana',
          destinationCity: 'Punta Cana',
          destinationCountry: 'Dominican Republic',
          estimatedTotalCost: 2050 + (day % 7) * 20,
          pricePerPerson: 1025,
          ptoDaysConsumed: 6,
          ptoEfficiencyRatio: 1.6,
          publicHolidaysCount: 0,
          requiresSchoolExemption: false,
          isArbitrageOpportunity: false,
          finalScore: 82 - (day % 8),
          scoreBreakdown: { priceIndex: 85, weatherIndex: 90, ptoEfficiencyIndex: 75, travelFrictionIndex: 80 },
        } as CandidateWindow);
      }

      const featured = mockWindows[0];
      const curated = curateDistinctAlternativeWindows(mockWindows, featured, 8);

      expect(curated.length).toBeLessThanOrEqual(8);
      expect(curated.length).toBeGreaterThanOrEqual(4);

      // Featured window itself must not be in the alternatives list
      const hasFeatured = curated.some(
        (c) => c.startDate === featured.startDate && c.originAirport === featured.originAirport
      );
      expect(hasFeatured).toBe(false);

      // No redundant consecutive dates (diff <= 2 days) for the same origin airport
      for (let i = 0; i < curated.length; i++) {
        for (let j = i + 1; j < curated.length; j++) {
          if (curated[i].originAirport === curated[j].originAirport) {
            const timeDiff = Math.abs(
              new Date(curated[i].startDate).getTime() - new Date(curated[j].startDate).getTime()
            );
            const daysDiff = timeDiff / (1000 * 60 * 60 * 24);
            expect(daysDiff).toBeGreaterThan(2);
          }
        }
      }

      // Alternative origin airport (FRA) is included among curated options
      const hasFra = curated.some((c) => c.originAirport === 'FRA');
      expect(hasFra).toBe(true);
    });

    it('models realistic airline day-of-week yield pricing (midweek flight discount vs weekend surge)', () => {
      // Midweek: Tuesday departure (2026-11-10) to Thursday return (2026-11-19)
      const midweekPricing = getSynchronousTripPricing({
        originAirport: 'FRA',
        destinationAirport: 'PUJ',
        startDate: '2026-11-10',
        endDate: '2026-11-19',
        durationDays: 10,
        party: {
          adults: 2,
          childrenAges: [],
        },
      });

      // Weekend: Saturday departure (2026-11-07) to Sunday return (2026-11-15)
      const weekendPricing = getSynchronousTripPricing({
        originAirport: 'FRA',
        destinationAirport: 'PUJ',
        startDate: '2026-11-07',
        endDate: '2026-11-15',
        durationDays: 9,
        party: {
          adults: 2,
          childrenAges: [],
        },
      });

      // Midweek flight multiplier must reflect off-peak airline yield (< 0.95 and isMidweekSaving = true)
      expect(midweekPricing.flight.dayOfWeekMultiplier).toBeLessThanOrEqual(0.92);
      expect(midweekPricing.flight.isMidweekSaving).toBe(true);

      // Weekend flight multiplier must reflect high peak airline demand (> 1.15 and isMidweekSaving = false)
      expect(weekendPricing.flight.dayOfWeekMultiplier).toBeGreaterThanOrEqual(1.18);
      expect(weekendPricing.flight.isMidweekSaving).toBe(false);

      // Base fare and total flight cost must be significantly lower on midweek flights than weekend flights
      expect(midweekPricing.flight.baseAdultFare).toBeLessThan(weekendPricing.flight.baseAdultFare);
      expect(midweekPricing.flight.totalFlightCost).toBeLessThan(weekendPricing.flight.totalFlightCost);
    });
  });

  describe('Vacation Style Specific Options (minBeachTemp & requireSnow)', () => {
    it('filters out beach destinations that do not meet minBeachTemp during winter', () => {
      const winterBeachInput: TripPlanInput = {
        destinationTypes: ['BEACH'],
        minBeachTemp: 22,
        durationDays: 7,
        durationDaysMin: 7,
        durationDaysMax: 7,
        earliestDate: '2026-01-10',
        latestDate: '2026-01-25',
        userProfile: {
          homeLocation: 'Karlsruhe',
          departureLat: 49.0069,
          departureLon: 8.4037,
          federalState: 'DE-BW',
          originAirports: ['FRA'],
          adults: 2,
          childrenAges: [],
          blackoutRanges: [],
        },
      };

      const results = optimizeVacationWindows(winterBeachInput, {}, {});
      expect(results.length).toBeGreaterThan(0);

      // Verify that every single returned window satisfies minBeachTemp >= 22°C
      for (const win of results) {
        const dayTemp = win.weather.maxTempC ?? win.weather.avgTempC;
        expect(dayTemp).toBeGreaterThanOrEqual(22);
        // Should not contain cold winter European beaches like Mallorca (PMI ~14°C) or Nice (NCE ~13°C)
        expect(['PMI', 'NCE', 'BCN']).not.toContain(win.destinationAirport);
      }
    });

    it('enforces requireSnow constraint for winter sports and provides snow assessment', () => {
      // 1. In January with requireSnow: true -> should return snow-covered alpine destinations
      const winterSkiInput: TripPlanInput = {
        destinationTypes: ['ALPINE'],
        requireSnow: true,
        durationDays: 7,
        durationDaysMin: 7,
        durationDaysMax: 7,
        earliestDate: '2026-01-10',
        latestDate: '2026-01-25',
        userProfile: {
          homeLocation: 'Karlsruhe',
          departureLat: 49.0069,
          departureLon: 8.4037,
          federalState: 'DE-BW',
          originAirports: ['FRA'],
          adults: 2,
          childrenAges: [],
          blackoutRanges: [],
        },
      };

      const skiResults = optimizeVacationWindows(winterSkiInput, {}, {});
      expect(skiResults.length).toBeGreaterThan(0);
      for (const win of skiResults) {
        expect(win.weather.hasSnow).toBe(true);
        expect(win.weather.snowDepthCm).toBeGreaterThan(0);
      }

      // 2. In July for Innsbruck (European Alps) with requireSnow: true -> summer alpine trips do not have ski snow guarantee
      const summerSkiInput: TripPlanInput = {
        targetDestinations: ['Innsbruck'],
        requireSnow: true,
        durationDays: 7,
        durationDaysMin: 7,
        durationDaysMax: 7,
        earliestDate: '2026-07-10',
        latestDate: '2026-07-25',
        userProfile: {
          homeLocation: 'Karlsruhe',
          departureLat: 49.0069,
          departureLon: 8.4037,
          federalState: 'DE-BW',
          originAirports: ['FRA'],
          adults: 2,
          childrenAges: [],
          blackoutRanges: [],
        },
      };

      const summerResults = optimizeVacationWindows(summerSkiInput, {}, {});
      // In mid-July, Innsbruck in the Austrian Alps does not have ski snow cover
      expect(summerResults.length).toBe(0);
    });

    it('ensures inland destinations like Oradea (OMR) are not falsely tagged as BEACH', () => {
      const styles = getDestinationVacationStyles('OMR');
      expect(styles).not.toContain('BEACH');
      expect(styles).toContain('CITY');
    });
  });
});




