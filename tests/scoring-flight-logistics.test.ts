import { describe, it, expect } from 'vitest';
import { resolveFlightRoute, findOptimalConnectingHub } from '@/lib/airports/flight-routes';
import { getSeasonalWarningPenalty } from '@/lib/optimizer/weather';
import { calculateFlightFrictionScore, optimizeVacationWindows } from '@/lib/optimizer/engine';
import { getSynchronousTripPricing } from '@/lib/pricing/pricing-service';
import { TripPlanInput, SchoolHoliday, PublicHoliday } from '@/lib/optimizer/types';

const mockHolidays: Record<string, SchoolHoliday[]> = { 'DE-BW': [] };
const mockPublicHolidays: Record<string, PublicHoliday[]> = { 'DE-BW': [] };

describe('1. Seasonal & Environmental Impact on Scoring', () => {
  it('calibrates penalties for natural phenomena and extreme weather correctly', () => {
    // Sargassum
    const sargassumImpact = getSeasonalWarningPenalty({
      destinationCode: 'CUN',
      seasonType: 'NATURAL_PHENOMENON',
      phenomenonType: 'SARGASSUM',
      monthRange: [4, 5, 6, 7],
      messageKey: 'sargassumWarning',
      fallbackMessage: 'Sargassum bloom',
    });
    expect(sargassumImpact).toBeDefined();
    expect(sargassumImpact?.weatherPenalty).toBe(20);
    expect(sargassumImpact?.overallScorePenalty).toBe(10);

    // Red Tide
    const redTideImpact = getSeasonalWarningPenalty({
      destinationCode: 'TPA',
      seasonType: 'NATURAL_PHENOMENON',
      phenomenonType: 'RED_TIDE',
      monthRange: [8, 9, 10],
      messageKey: 'redTideWarning',
      fallbackMessage: 'Red Tide algal bloom',
    });
    expect(redTideImpact?.weatherPenalty).toBe(22);
    expect(redTideImpact?.overallScorePenalty).toBe(12);

    // Extreme Heat
    const heatImpact = getSeasonalWarningPenalty({
      destinationCode: 'DXB',
      seasonType: 'EXTREME_HEAT',
      monthRange: [6, 7, 8],
      messageKey: 'extremeHeatWarning',
      fallbackMessage: 'Extreme heat',
    });
    expect(heatImpact?.weatherPenalty).toBe(22);
    expect(heatImpact?.overallScorePenalty).toBe(10);

    // Typhoon / Hurricane
    const typhoonImpact = getSeasonalWarningPenalty({
      destinationCode: 'MIA',
      seasonType: 'TYPHOON_HURRICANE',
      monthRange: [7, 8, 9, 10],
      messageKey: 'hurricaneWarning',
      fallbackMessage: 'Hurricane season',
    });
    expect(typhoonImpact?.weatherPenalty).toBe(28);
    expect(typhoonImpact?.overallScorePenalty).toBe(14);

    // Marine Stingers / Jellyfish
    const jellyfishImpact = getSeasonalWarningPenalty({
      destinationCode: 'CNS',
      seasonType: 'NATURAL_PHENOMENON',
      phenomenonType: 'JELLYFISH',
      monthRange: [10, 11, 0, 1, 2, 3, 4],
      messageKey: 'jellyfishWarning',
      fallbackMessage: 'Marine stingers',
    });
    expect(jellyfishImpact?.weatherPenalty).toBe(16);
    expect(jellyfishImpact?.overallScorePenalty).toBe(8);

    // Highland Midges / Sandflies
    const midgeImpact = getSeasonalWarningPenalty({
      destinationCode: 'INV',
      seasonType: 'NATURAL_PHENOMENON',
      phenomenonType: 'MIDGE_SANDFLY',
      monthRange: [5, 6, 7],
      messageKey: 'midgeWarning',
      fallbackMessage: 'Highland midges',
    });
    expect(midgeImpact?.weatherPenalty).toBe(16);
    expect(midgeImpact?.overallScorePenalty).toBe(8);

    // Overcrowded Hyper-Peak (festivals, Golden Week, school-holiday surges): weighted heavily
    // enough to meaningfully outrank warning-free alternatives, not just nudge them.
    const crowdedPeakImpact = getSeasonalWarningPenalty({
      destinationCode: 'HND',
      seasonType: 'OVERCROWDED_PEAK',
      monthRange: [3],
      messageKey: 'seasonWarningCrowdedPeak',
      fallbackMessage: 'Golden Week hyper-peak',
    });
    expect(crowdedPeakImpact?.weatherPenalty).toBe(14);
    expect(crowdedPeakImpact?.overallScorePenalty).toBe(12);
    expect(crowdedPeakImpact?.severity).toBe('high');

    // Extreme heat during a window several source markets are on school holiday is really a
    // crowding penalty in disguise - same weight as OVERCROWDED_PEAK.
    const heatCrowdImpact = getSeasonalWarningPenalty(
      {
        destinationCode: 'PMI',
        seasonType: 'EXTREME_HEAT',
        monthRange: [7],
        messageKey: 'extremeHeatWarning',
        fallbackMessage: 'Extreme heat',
        marketsOnHoliday: ['DE', 'GB', 'FR'],
      },
      { avoidExtremeHeat: false }
    );
    expect(heatCrowdImpact?.weatherPenalty).toBe(14);
    expect(heatCrowdImpact?.overallScorePenalty).toBe(12);
  });

  it('applies seasonal quality penalty directly to destination window scores during optimization', async () => {
    // Cancun (CUN) in July has active Sargassum warning
    const julyPlan: TripPlanInput = {
      targetDestinations: ['CUN'],
      durationDays: 7,
      durationDaysMin: 7,
      durationDaysMax: 7,
      earliestDate: '2027-07-01',
      latestDate: '2027-07-20',
      userProfile: {
        homeLocation: 'Frankfurt, Germany',
        federalState: 'DE-BW',
        originAirports: ['FRA'],
        adults: 2,
        childrenAges: [],
        blackoutRanges: [],
      },
    };

    const julyWindows = await optimizeVacationWindows(julyPlan, mockHolidays, mockPublicHolidays);
    expect(julyWindows.length).toBeGreaterThan(0);
    const cunJulyWindow = julyWindows[0];

    expect(cunJulyWindow.seasonalWarning).toBeDefined();
    expect(cunJulyWindow.seasonalWarning?.phenomenonType).toBe('SARGASSUM');
    expect(cunJulyWindow.seasonalWarningPenalty).toBe(10);
    expect(cunJulyWindow.seasonalWarningImpact).toBeDefined();
    expect(cunJulyWindow.seasonalWarningImpact?.weatherPenalty).toBe(20);
    expect(cunJulyWindow.seasonalWarningImpact?.overallScorePenalty).toBe(10);

    // Cancun (CUN) in December/January has NO Sargassum warning
    const decPlan: TripPlanInput = {
      targetDestinations: ['CUN'],
      durationDays: 7,
      durationDaysMin: 7,
      durationDaysMax: 7,
      earliestDate: '2026-12-01',
      latestDate: '2026-12-20',
      userProfile: {
        homeLocation: 'Frankfurt, Germany',
        federalState: 'DE-BW',
        originAirports: ['FRA'],
        adults: 2,
        childrenAges: [],
        blackoutRanges: [],
      },
    };

    const decWindows = await optimizeVacationWindows(decPlan, mockHolidays, mockPublicHolidays);
    expect(decWindows.length).toBeGreaterThan(0);
    const cunDecWindow = decWindows[0];

    expect(cunDecWindow.seasonalWarning).toBeFalsy();
    expect(cunDecWindow.seasonalWarningPenalty).toBe(0);
    expect(cunDecWindow.seasonalWarningImpact).toBeFalsy();
  });
});

describe('2. Non-Direct Flight Visibility & Route Resolution', () => {
  it('resolves direct European flights with single segment and zero layovers', () => {
    const route = resolveFlightRoute('FRA', 'PMI'); // Frankfurt to Mallorca
    expect(route.isDirect).toBe(true);
    expect(route.stops).toBe(0);
    expect(route.segments.length).toBe(1);
    expect(route.layovers.length).toBe(0);
    expect(route.segments[0].departureAirport).toBe('FRA');
    expect(route.segments[0].arrivalAirport).toBe('PMI');
    expect(route.segments[0].distanceKm).toBeGreaterThan(1000);
    expect(route.segments[0].durationMinutes).toBeGreaterThan(90);
    expect(route.directFlightPremiumMultiplier).toBe(1.18);
    expect(route.connectingSavingsDiscount).toBe(0);
    expect(route.layoverScorePenalty).toBe(0);
  });

  it('resolves connecting flights with intermediate hubs, layover durations, and transfer breakdown', () => {
    // Regional FKB (Karlsruhe/Baden-Baden) to Phuket (HKT) requires connecting via a major hub
    const route = resolveFlightRoute('FKB', 'HKT');
    expect(route.isDirect).toBe(false);
    expect(route.stops).toBeGreaterThanOrEqual(1);
    expect(route.segments.length).toBeGreaterThanOrEqual(2);
    expect(route.layovers.length).toBeGreaterThanOrEqual(1);

    const firstLayover = route.layovers[0];
    expect(firstLayover.airportCode).toBeTruthy();
    expect(firstLayover.durationMinutes).toBeGreaterThanOrEqual(60);
    expect(firstLayover.durationMinutes).toBeLessThanOrEqual(240);

    // Total duration accounts for segments flight time plus layover time
    const sumSegmentTime = route.segments.reduce((acc, s) => acc + s.durationMinutes, 0);
    const sumLayoverTime = route.layovers.reduce((acc, l) => acc + l.durationMinutes, 0);
    expect(route.totalFlightDurationMinutes).toBe(sumSegmentTime + sumLayoverTime);
  });

  it('selects geographically coherent connecting hubs', () => {
    // Transatlantic / Far East from small regional German airport FKB connects via European primary hubs
    const hub = findOptimalConnectingHub('FKB', 'HND'); // to Tokyo
    expect(hub).toBeDefined();
    expect(['FRA', 'MUC', 'CDG', 'AMS', 'LHR', 'IST', 'DOH', 'DXB']).toContain(hub?.code);
  });
});

describe('3. Layover-Weighted Scoring', () => {
  it('penalizes flight convenience / friction proportionally to stops and layover duration', () => {
    const dist = 3000;
    const directScore = calculateFlightFrictionScore(dist, 0, 0);
    const oneStopScore = calculateFlightFrictionScore(dist, 1, 90);
    const twoStopsScore = calculateFlightFrictionScore(dist, 2, 210);

    // 1 stop has ~16-20 point drop
    expect(directScore - oneStopScore).toBeGreaterThanOrEqual(16);
    // 2 stops has a much larger drop (~35-40 points)
    expect(oneStopScore - twoStopsScore).toBeGreaterThanOrEqual(15);
    expect(directScore - twoStopsScore).toBeGreaterThanOrEqual(35);
  });

  it('reflects layover deduction in optimized candidate window scores', async () => {
    const planWithRegionalOrigin: TripPlanInput = {
      targetDestinations: ['HKT'],
      durationDays: 7,
      durationDaysMin: 7,
      durationDaysMax: 7,
      earliestDate: '2026-11-01',
      latestDate: '2026-11-20',
      // Exercise the layover mechanics themselves (rail-and-fly would replace the feeder leg)
      railAirSuggestions: false,
      userProfile: {
        homeLocation: 'Karlsruhe, Germany',
        federalState: 'DE-BW',
        originAirports: ['FKB'], // Regional airport without direct flight to Phuket
        adults: 2,
        childrenAges: [],
        blackoutRanges: [],
      },
    };

    const windows = await optimizeVacationWindows(planWithRegionalOrigin, mockHolidays, mockPublicHolidays);
    expect(windows.length).toBeGreaterThan(0);
    const window = windows[0];

    expect(window.isDirectFlight).toBe(false);
    expect(window.flightStops).toBeGreaterThanOrEqual(1);
    expect(window.flightLayovers).toBeDefined();
    expect(window.flightLayovers!.length).toBeGreaterThanOrEqual(1);
    expect(window.layoverPenalty).toBeGreaterThan(0);
  });
});

describe('4. Layover Tolerance Preference / Filter', () => {
  it('strictly restricts results to direct flights when maxFlightStops is 0', async () => {
    const directOnlyPlan: TripPlanInput = {
      destinationTypes: ['BEACH'],
      durationDays: 7,
      durationDaysMin: 7,
      durationDaysMax: 7,
      earliestDate: '2026-06-01',
      latestDate: '2026-06-20',
      maxFlightStops: 0,
      userProfile: {
        homeLocation: 'Frankfurt, Germany',
        federalState: 'DE-BW',
        originAirports: ['FRA'],
        adults: 2,
        childrenAges: [],
        blackoutRanges: [],
        maxFlightStops: 0,
      },
    };

    const windows = await optimizeVacationWindows(directOnlyPlan, mockHolidays, mockPublicHolidays);
    expect(windows.length).toBeGreaterThan(0);
    for (const w of windows) {
      expect(w.isDirectFlight).toBe(true);
      expect(w.flightStops).toBe(0);
      expect(w.flightLayovers?.length || 0).toBe(0);
    }
  });

  it('excludes connecting-only destinations when maxFlightStops is 0 and only regional airport is selected', async () => {
    const plan: TripPlanInput = {
      targetDestinations: ['HKT'], // Phuket has no direct flights from regional FKB
      durationDays: 7,
      durationDaysMin: 7,
      durationDaysMax: 7,
      earliestDate: '2026-11-01',
      latestDate: '2026-11-20',
      maxFlightStops: 0,
      railAirSuggestions: false,
      userProfile: {
        homeLocation: 'Karlsruhe, Germany',
        federalState: 'DE-BW',
        originAirports: ['FKB'],
        adults: 2,
        childrenAges: [],
        blackoutRanges: [],
        maxFlightStops: 0,
      },
    };

    const windows = await optimizeVacationWindows(plan, mockHolidays, mockPublicHolidays);
    // Zero candidates because HKT from FKB requires at least 1 stop
    expect(windows.length).toBe(0);

    // With rail-and-fly enabled (default), the train to a hub with a non-stop flight satisfies
    // the direct-only preference instead of returning nothing.
    // Bangkok: no non-stop from FKB, but Frankfurt (reachable by train) flies there non-stop
    const railAir = await optimizeVacationWindows({ ...plan, targetDestinations: ['BKK'], railAirSuggestions: undefined }, mockHolidays, mockPublicHolidays);
    expect(railAir.length).toBeGreaterThan(0);
    expect(railAir.every((w) => w.flightStops === 0 && w.railFeeder)).toBe(true);
  });

  it('allows connecting routes when maxFlightStops is 1 or undefined', async () => {
    const plan: TripPlanInput = {
      targetDestinations: ['HKT'],
      durationDays: 7,
      durationDaysMin: 7,
      durationDaysMax: 7,
      earliestDate: '2026-11-01',
      latestDate: '2026-11-20',
      maxFlightStops: 1,
      userProfile: {
        homeLocation: 'Karlsruhe, Germany',
        federalState: 'DE-BW',
        originAirports: ['FKB'],
        adults: 2,
        childrenAges: [],
        blackoutRanges: [],
        maxFlightStops: 1,
      },
    };

    const windows = await optimizeVacationWindows(plan, mockHolidays, mockPublicHolidays);
    expect(windows.length).toBeGreaterThan(0);
    expect(windows[0].flightStops).toBeLessThanOrEqual(1);
  });
});

describe('5. Flight Pricing & Direct-Flight Premium Calculation', () => {
  it('applies direct flight premium multiplier to direct routes in pricing service', () => {
    const directPricing = getSynchronousTripPricing({
      destinationAirport: 'PMI',
      originAirport: 'FRA',
      startDate: '2026-07-10',
      endDate: '2026-07-17',
      durationDays: 7,
      party: { adults: 2, childrenAges: [] },
    });

    expect(directPricing.flight).toBeDefined();
    expect(directPricing.flight?.isDirectFlight).toBe(true);
    expect(directPricing.flight?.stops).toBe(0);
    expect(directPricing.flight?.directFlightPremiumMultiplier).toBe(1.18);
    expect(directPricing.flight?.connectingSavingsDiscount).toBe(0);
  });

  it('applies connecting route savings discount to multi-leg flights in pricing service', () => {
    const connectingPricing = getSynchronousTripPricing({
      destinationAirport: 'HKT',
      originAirport: 'FKB',
      startDate: '2026-11-10',
      endDate: '2026-11-17',
      durationDays: 7,
      party: { adults: 2, childrenAges: [] },
    });

    expect(connectingPricing.flight).toBeDefined();
    expect(connectingPricing.flight?.isDirectFlight).toBe(false);
    expect(connectingPricing.flight?.stops).toBeGreaterThanOrEqual(1);
    expect(connectingPricing.flight?.directFlightPremiumMultiplier).toBe(1.0);
    expect(connectingPricing.flight?.connectingSavingsDiscount).toBeGreaterThanOrEqual(0.15);
    expect(connectingPricing.flight?.layovers).toBeDefined();
    expect(connectingPricing.flight?.segments).toBeDefined();
    expect(connectingPricing.flight?.segments!.length).toBeGreaterThanOrEqual(2);
  });
});
