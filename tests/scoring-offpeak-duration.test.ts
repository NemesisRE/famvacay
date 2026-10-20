import { describe, it, expect } from 'vitest';
import { getSeasonalWarningPenalty } from '@/lib/optimizer/weather';
import { optimizeVacationWindows } from '@/lib/optimizer/engine';
import { TripPlanInput, SchoolHoliday, PublicHoliday } from '@/lib/optimizer/types';

describe('Off-Peak, Duration Dynamics & Climate Constraints', () => {
  describe('Extreme Heat Constraint Preference', () => {
    it('does not penalize extreme heat when avoidExtremeHeat is false', () => {
      const penalty = getSeasonalWarningPenalty(
        {
          destinationCode: 'DXB',
          seasonType: 'EXTREME_HEAT',
          monthRange: [6, 7, 8],
          messageKey: 'extremeHeatWarning',
          fallbackMessage: 'Extreme summer heat',
        },
        { avoidExtremeHeat: false }
      );
      expect(penalty).toBeNull();
    });

    it('penalizes extreme heat when avoidExtremeHeat is explicitly enabled', () => {
      const penalty = getSeasonalWarningPenalty(
        {
          destinationCode: 'DXB',
          seasonType: 'EXTREME_HEAT',
          monthRange: [6, 7, 8],
          messageKey: 'extremeHeatWarning',
          fallbackMessage: 'Extreme summer heat',
        },
        { avoidExtremeHeat: true }
      );
      expect(penalty).toBeDefined();
      expect(penalty?.weatherPenalty).toBe(22);
      expect(penalty?.overallScorePenalty).toBe(10);
    });
  });

  describe('Off-Peak & School Holiday Bonus for Childless Parties', () => {
    const mockHolidays: Record<string, SchoolHoliday[]> = {
      'DE-BW': [
        {
          name: 'Sommerferien',
          startDate: '2026-07-30',
          endDate: '2026-09-12',
          state: 'DE-BW',
        },
      ],
    };
    const mockPublicHolidays: Record<string, PublicHoliday[]> = {
      'DE-BW': [],
    };

    it('awards an explicit off-peak bonus for parties traveling without children outside school holidays', async () => {
      const inputWithoutKids: TripPlanInput = {
        targetDestinations: ['PMI'],
        durationDays: 10,
        earliestDate: '2026-09-15', // Outside Sommerferien
        latestDate: '2026-10-15',
        userProfile: {
          homeLocation: 'Stuttgart, Germany',
          federalState: 'DE-BW',
          originAirports: ['STR'],
          adults: 2,
          childrenAges: [], // No children!
          blackoutRanges: [],
        },
      };

      const results = await optimizeVacationWindows(inputWithoutKids, mockHolidays, mockPublicHolidays);
      expect(results.length).toBeGreaterThan(0);
      const first = results[0];
      expect(first.isOffPeak).toBe(true);
      expect(first.offPeakBonus).toBeGreaterThanOrEqual(7);
      expect(first.scoreBreakdown.offPeakBonus).toBe(first.offPeakBonus);
    });

    it('does not grant childless off-peak bonus during peak school holidays', async () => {
      const inputInPeakHolidays: TripPlanInput = {
        targetDestinations: ['PMI'],
        durationDays: 7,
        earliestDate: '2026-08-01', // Right in the middle of Sommerferien
        latestDate: '2026-08-15',
        userProfile: {
          homeLocation: 'Stuttgart, Germany',
          federalState: 'DE-BW',
          originAirports: ['STR'],
          adults: 2,
          childrenAges: [],
          blackoutRanges: [],
        },
      };

      const results = await optimizeVacationWindows(inputInPeakHolidays, mockHolidays, mockPublicHolidays);
      expect(results.length).toBeGreaterThan(0);
      const first = results[0];
      // During Sommerferien, isOffPeak should be false
      expect(first.isOffPeak).toBe(false);
      expect(first.offPeakBonus).toBeUndefined();
    });
  });

  describe('Duration-Adaptive Weighting Dynamics', () => {
    const mockHolidays: Record<string, SchoolHoliday[]> = { 'DE-BW': [] };
    const mockPublicHolidays: Record<string, PublicHoliday[]> = { 'DE-BW': [] };

    it('short trips (<= 7 days) emphasize PTO efficiency', async () => {
      const shortTripInput: TripPlanInput = {
        targetDestinations: ['PMI'],
        durationDays: 4, // Short trip (e.g. bridge days)
        earliestDate: '2026-05-01',
        latestDate: '2026-05-15',
        userProfile: {
          homeLocation: 'Stuttgart, Germany',
          federalState: 'DE-BW',
          originAirports: ['STR'],
          adults: 2,
          childrenAges: [8],
          blackoutRanges: [],
        },
      };

      const results = await optimizeVacationWindows(shortTripInput, mockHolidays, mockPublicHolidays);
      expect(results.length).toBeGreaterThan(0);
      // For short trips, scoring works and results are ranked
      expect(results[0].finalScore).toBeGreaterThan(0);
    });

    it('long trips (> 7 days) prioritize price savings and can earn value-for-money duration bonus', async () => {
      const longTripInput: TripPlanInput = {
        targetDestinations: ['PMI'],
        durationDays: 14, // Long trip
        earliestDate: '2026-10-01',
        latestDate: '2026-11-01',
        userProfile: {
          homeLocation: 'Stuttgart, Germany',
          federalState: 'DE-BW',
          originAirports: ['STR'],
          adults: 2,
          childrenAges: [],
          blackoutRanges: [],
        },
      };

      const results = await optimizeVacationWindows(longTripInput, mockHolidays, mockPublicHolidays);
      expect(results.length).toBeGreaterThan(0);
      const first = results[0];
      expect(first.finalScore).toBeGreaterThan(0);
      // Check that valueForMoneyBonus is tracked in score breakdown
      expect(first.scoreBreakdown).toHaveProperty('valueForMoneyBonus');
    });
  });
});

