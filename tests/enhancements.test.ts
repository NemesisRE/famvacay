import { describe, it, expect } from 'vitest';
import { getDestinationSeasonalWarning } from '@/lib/optimizer/weather';
import { getLocalizedSeasonalWarning } from '@/lib/optimizer/localized-warnings';
import { resolveDestinationBoardType, calculateMealPlanDailyValue } from '@/lib/pricing/pricing-service';
import { optimizeVacationWindows } from '@/lib/optimizer/engine';
import { TripPlanInput, SchoolHoliday, PublicHoliday } from '@/lib/optimizer/types';
import { en } from '@/lib/i18n/locales/en';
import { de } from '@/lib/i18n/locales/de';

describe('Natural Phenomenon Seasonal Warnings', () => {
  it('detects Sargassum seaweed bloom along Mexican Caribbean coast in summer', () => {
    // Cancun (CUN) in July (month 6 in 0-indexed month system)
    const warning = getDestinationSeasonalWarning('CUN', 6);
    expect(warning).toBeDefined();
    expect(warning?.seasonType).toBe('NATURAL_PHENOMENON');
    expect(warning?.phenomenonType).toBe('SARGASSUM');
    if (warning) {
      const localizedEn = getLocalizedSeasonalWarning(warning, en);
      expect(localizedEn.title).toContain('Sargassum Seaweed Bloom');
      const localizedDe = getLocalizedSeasonalWarning(warning, de);
      expect(localizedDe.title).toContain('Braunalgen');
    }
  });

  it('detects Red Tide algal blooms along Florida Gulf Coast in autumn', () => {
    // Tampa / St. Petersburg (TPA) in October (month 9 in 0-indexed)
    const warning = getDestinationSeasonalWarning('TPA', 9);
    expect(warning).toBeDefined();
    expect(warning?.seasonType).toBe('NATURAL_PHENOMENON');
    expect(warning?.phenomenonType).toBe('RED_TIDE');
    if (warning) {
      const localizedEn = getLocalizedSeasonalWarning(warning, en);
      expect(localizedEn.title).toContain('Red Tide');
    }
  });

  it('detects Marine Stinger / Jellyfish corridor in tropical Australia during summer', () => {
    // Cairns (CNS) in November (month 10 in 0-indexed) - stinger season onset before cyclone peak
    const warning = getDestinationSeasonalWarning('CNS', 10);
    expect(warning).toBeDefined();
    expect(warning?.seasonType).toBe('NATURAL_PHENOMENON');
    expect(warning?.phenomenonType).toBe('JELLYFISH');
    if (warning) {
      const localizedEn = getLocalizedSeasonalWarning(warning, en);
      expect(localizedEn.title).toContain('Jellyfish');
    }
  });

  it('detects Highland Midge / Sandfly peak swarming in Scotland in July', () => {
    // Inverness / Highlands (INV) in July (month 6 in 0-indexed)
    const warning = getDestinationSeasonalWarning('INV', 6);
    expect(warning).toBeDefined();
    expect(warning?.seasonType).toBe('NATURAL_PHENOMENON');
    expect(warning?.phenomenonType).toBe('MIDGE_SANDFLY');
    if (warning) {
      const localizedEn = getLocalizedSeasonalWarning(warning, en);
      expect(localizedEn.title).toContain('Midge');
    }
  });

  it('detects Periodical Cicada emergence in US Midwest in June', () => {
    // St. Louis (STL) in June (month 5 in 0-indexed)
    const warning = getDestinationSeasonalWarning('STL', 5);
    expect(warning).toBeDefined();
    expect(warning?.seasonType).toBe('NATURAL_PHENOMENON');
    expect(warning?.phenomenonType).toBe('CICADA');
    if (warning) {
      const localizedEn = getLocalizedSeasonalWarning(warning, en);
      expect(localizedEn.title).toContain('Cicada');
    }
  });

  it('detects Volcanic Vog / Sulfur Haze on Hawaii Big Island', () => {
    // Kona (KOA) in May (month 4 in 0-indexed)
    const warning = getDestinationSeasonalWarning('KOA', 4);
    expect(warning).toBeDefined();
    expect(warning?.seasonType).toBe('NATURAL_PHENOMENON');
    expect(warning?.phenomenonType).toBe('VOLCANIC_VOG');
    if (warning) {
      const localizedEn = getLocalizedSeasonalWarning(warning, en);
      expect(localizedEn.title).toContain('Vog');
    }
  });
});

describe('Board Types & Fair Meal Plan Value Calculation', () => {
  it('correctly resolves board type archetypes across destinations', () => {
    // Egyptian / Turkish resorts default to ALL_INCLUSIVE
    expect(resolveDestinationBoardType('HRG')).toBe('ALL_INCLUSIVE');
    expect(resolveDestinationBoardType('AYT')).toBe('ALL_INCLUSIVE');
    expect(resolveDestinationBoardType('PUJ')).toBe('ALL_INCLUSIVE');

    // Mallorca / Alps resort hotels default to HALF_BOARD
    expect(resolveDestinationBoardType('PMI')).toBe('HALF_BOARD');
    expect(resolveDestinationBoardType('INN')).toBe('HALF_BOARD');

    // Metropolises default to BREAKFAST
    expect(resolveDestinationBoardType('CDG')).toBe('BREAKFAST');
    expect(resolveDestinationBoardType('LHR')).toBe('BREAKFAST');
  });

  it('calculates daily meal plan value weighted by party composition', () => {
    // 2 adults, 2 children
    // ALL_INCLUSIVE: dailyAdult = 55, dailyChild = 30
    // Total per day: 2 * 55 + 2 * 30 = 170 EUR/day
    const dailyValue = calculateMealPlanDailyValue('ALL_INCLUSIVE', 2, [8, 12]);
    expect(dailyValue.dailyAdult).toBe(55);
    expect(dailyValue.dailyChild).toBe(30);
    expect(dailyValue.totalDaily).toBe(170);

    // BREAKFAST: dailyAdult = 14, dailyChild = 8
    // Total per day: 2 * 14 + 1 * 8 = 36 EUR/day
    const bfDailyValue = calculateMealPlanDailyValue('BREAKFAST', 2, [8]);
    expect(bfDailyValue.dailyAdult).toBe(14);
    expect(bfDailyValue.dailyChild).toBe(8);
    expect(bfDailyValue.totalDaily).toBe(36);
  });
});

describe('Optimizer Overland Travel Duration Filtering & Board Integration', () => {
  const mockSchoolHolidays: Record<string, SchoolHoliday[]> = {
    'DE-BW': [
      {
        startDate: '2026-07-30',
        endDate: '2026-09-12',
        name: 'Sommerferien BW',
        state: 'DE-BW',
      },
    ],
  };

  const mockPublicHolidays: Record<string, PublicHoliday[]> = {
    'DE-BW': [],
  };

  it('constrains overland travel windows when maxOverlandTravelMinutes is set', () => {
    const input: TripPlanInput = {
      targetRegion: 'INN', // Innsbruck / Austria
      durationDays: 7,
      earliestDate: '2026-08-01',
      latestDate: '2026-08-15',
      travelVehicle: 'CAR',
      // Stuttgart to Innsbruck is ~3.5 to 4 hours by car (~220-250 minutes)
      // Setting maxOverlandTravelMinutes to 90 minutes should filter out all windows
      maxOverlandTravelMinutes: 90,
      userProfile: {
        homeLocation: 'Stuttgart, Germany',
        departureLat: 48.7758,
        departureLon: 9.1829,
        federalState: 'DE-BW',
        originAirports: ['STR'],
        adults: 2,
        childrenAges: [],
        blackoutRanges: [],
      },
    };

    const constrained = optimizeVacationWindows(input, mockSchoolHolidays, mockPublicHolidays);
    expect(constrained.length).toBe(0);

    // Allowing 300 minutes (5 hours) should yield candidate windows
    const relaxed = optimizeVacationWindows(
      { ...input, maxOverlandTravelMinutes: 300 },
      mockSchoolHolidays,
      mockPublicHolidays
    );
    expect(relaxed.length).toBeGreaterThan(0);

    const win = relaxed[0];
    expect(win.destinationSafety).toBeDefined();
    expect(win.destinationSafety?.isSafe).toBe(true);
    expect(win.boardType).toBe('HALF_BOARD');
    expect(win.mealPlanValue).toBeGreaterThan(0);
    expect(win.effectiveCost).toBeLessThan(win.estimatedTotalCost);
  });
});
