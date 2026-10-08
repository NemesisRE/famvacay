import { addDays, parseISO, format, isWithinInterval, isBefore, isAfter } from 'date-fns';
import {
  TripPlanInput,
  CandidateWindow,
  PublicHoliday,
  SchoolHoliday,
  OptimizationWeights,
  DEFAULT_WEIGHTS,
} from './types';
import { calculatePtoDaysConsumed } from './pto-calculator';
import { calculatePassengerCostMultiplier } from './child-tiers';
import { NEIGHBORING_STATES, SUPPORTED_ORIGIN_AIRPORTS, calculateDistanceKm } from './arbitrage';
import { POPULAR_DESTINATIONS, getEstimatedClimate } from './weather';

/**
 * Filter blackout dates: Checks if [candidateStart, candidateEnd] overlaps with any blackout range.
 */
export function overlapsWithBlackout(
  startStr: string,
  endStr: string,
  blackouts: { startDate: string; endDate: string }[]
): boolean {
  const start = parseISO(startStr);
  const end = parseISO(endStr);

  for (const b of blackouts) {
    const bStart = parseISO(b.startDate);
    const bEnd = parseISO(b.endDate);

    // Overlap condition: start <= bEnd && end >= bStart
    if (start <= bEnd && end >= bStart) {
      return true;
    }
  }
  return false;
}

/**
 * Checks if [startStr, endStr] falls ENTIRELY inside at least one school holiday period.
 */
export function isWithinSchoolHoliday(
  startStr: string,
  endStr: string,
  holidays: SchoolHoliday[]
): boolean {
  const start = parseISO(startStr);
  const end = parseISO(endStr);

  for (const h of holidays) {
    const hStart = parseISO(h.startDate);
    const hEnd = parseISO(h.endDate);

    if (start >= hStart && end <= hEnd) {
      return true;
    }
  }
  return false;
}

/**
 * Normalizes an array of values to a 0-100 scale.
 * If higherIsBetter is false, the lower values get higher scores (e.g. price, PTO days).
 */
export function normalizeScore(
  val: number,
  min: number,
  max: number,
  higherIsBetter: boolean = true
): number {
  if (max === min) return 80; // Baseline neutral score if no variance
  const clamped = Math.max(min, Math.min(max, val));
  const ratio = (clamped - min) / (max - min);
  const score = higherIsBetter ? ratio * 100 : (1 - ratio) * 100;
  return Math.round(score * 10) / 10;
}

/**
 * Core CSP Vacation Window Optimizer
 */
export function optimizeVacationWindows(
  input: TripPlanInput,
  schoolHolidaysByState: Record<string, SchoolHoliday[]>,
  publicHolidaysByState: Record<string, PublicHoliday[]>,
  weights: OptimizationWeights = DEFAULT_WEIGHTS
): CandidateWindow[] {
  const { userProfile, durationDays, earliestDate, latestDate, destinationType, targetRegion } = input;
  const hasSchoolKids = userProfile.childrenAges.some((age) => age >= 6);
  const homeState = userProfile.federalState;
  const homeSchoolHolidays = schoolHolidaysByState[homeState] || [];
  const homePublicHolidays = publicHolidaysByState[homeState] || [];

  const originAirports = userProfile.originAirports.length > 0
    ? userProfile.originAirports
    : ['STR', 'FRA'];

  // Select destination codes
  let candidateDestinations: string[] = [];
  if (targetRegion && POPULAR_DESTINATIONS[targetRegion]) {
    candidateDestinations = [targetRegion];
  } else {
    // Filter popular destinations matching destinationType
    candidateDestinations = Object.values(POPULAR_DESTINATIONS)
      .filter((d) => d.type === destinationType)
      .map((d) => d.code);
    if (candidateDestinations.length === 0) {
      candidateDestinations = ['PMI', 'BCN', 'FAO'];
    }
  }

  const pCostMultiplier = calculatePassengerCostMultiplier(2, userProfile.childrenAges);

  const candidatePool: Omit<CandidateWindow, 'finalScore' | 'scoreBreakdown'>[] = [];

  const earliest = parseISO(earliestDate);
  const latest = parseISO(latestDate);

  // Generate candidate dates
  let currentDate = earliest;
  while (true) {
    const windowEnd = addDays(currentDate, durationDays - 1);
    if (isAfter(windowEnd, latest)) {
      break;
    }

    const startStr = format(currentDate, 'yyyy-MM-dd');
    const endStr = format(windowEnd, 'yyyy-MM-dd');
    const monthIndex = currentDate.getMonth();

    // 1. Blackout Filtering
    if (overlapsWithBlackout(startStr, endStr, userProfile.blackoutRanges)) {
      currentDate = addDays(currentDate, 1);
      continue;
    }

    // 2. School Holiday Enforcement (for home state)
    let homeInsideHoliday = true;
    if (hasSchoolKids) {
      homeInsideHoliday = isWithinSchoolHoliday(startStr, endStr, homeSchoolHolidays);
      if (!homeInsideHoliday) {
        currentDate = addDays(currentDate, 1);
        continue;
      }
    }

    // 3. PTO consumption calculation
    const ptoInfo = calculatePtoDaysConsumed(startStr, endStr, homePublicHolidays);

    // 4. Test each origin airport and destination combination
    for (const origin of originAirports) {
      const airportDetails = SUPPORTED_ORIGIN_AIRPORTS[origin];
      const airportState = airportDetails?.state || homeState;
      const isArbitrage = airportState !== homeState;

      // Arbitrage check: If departing from an airport in neighboring state, check if that state is NOT on holiday
      let arbitrageNote: string | undefined;
      let arbitrageState: string | undefined;

      if (isArbitrage) {
        const neighborHolidays = schoolHolidaysByState[airportState] || [];
        const neighborInHoliday = isWithinSchoolHoliday(startStr, endStr, neighborHolidays);
        if (!neighborInHoliday) {
          arbitrageNote = `Arbitrage opportunity: Depart from ${origin} (${airportState}) where schools are in session! Flight fares typically 25-45% lower.`;
          arbitrageState = airportState;
        }
      }

      for (const dest of candidateDestinations) {
        // Weather assessment
        const weather = getEstimatedClimate(dest, monthIndex);
        if (!weather.isSuitable) {
          // Weather suitability filter
          continue;
        }

        // Base price calculation with simulated pricing model & arbitrage discount
        let baseFare = 140; // Base baseline per adult
        if (monthIndex >= 6 && monthIndex <= 7) {
          baseFare = 280; // Peak summer season
        } else if (monthIndex === 3 || monthIndex === 4 || monthIndex === 9) {
          baseFare = 190; // Shoulder season
        }

        // Apply arbitrage discount if schools are NOT on holiday at departure airport
        if (isArbitrage && arbitrageNote) {
          baseFare = Math.round(baseFare * 0.70); // 30% arbitrage discount
        }

        const totalCost = Math.round(baseFare * pCostMultiplier);
        const perPersonCost = Math.round(totalCost / (2 + userProfile.childrenAges.length));

        // Budget check
        if (input.maxBudgetTotal && totalCost > input.maxBudgetTotal) {
          continue;
        }

        const ptoEfficiencyRatio = ptoInfo.ptoDaysConsumed > 0
          ? Math.round((durationDays / ptoInfo.ptoDaysConsumed) * 10) / 10
          : durationDays * 2;

        candidatePool.push({
          startDate: startStr,
          endDate: endStr,
          durationDays,
          originAirport: origin,
          destinationAirport: dest,
          totalWeekdays: ptoInfo.totalWeekdays,
          publicHolidaysCount: ptoInfo.publicHolidaysCount,
          ptoDaysConsumed: ptoInfo.ptoDaysConsumed,
          ptoEfficiencyRatio,
          estimatedTotalCost: totalCost,
          pricePerPerson: perPersonCost,
          isCachedBenchmark: true,
          weather,
          isArbitrageOpportunity: Boolean(arbitrageNote),
          arbitrageOriginState: arbitrageState,
          arbitrageNote,
        });
      }
    }

    currentDate = addDays(currentDate, 1);
  }

  if (candidatePool.length === 0) {
    return [];
  }

  // Calculate min/max for multi-objective scoring
  const prices = candidatePool.map((c) => c.estimatedTotalCost);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  const ptos = candidatePool.map((c) => c.ptoDaysConsumed);
  const minPto = Math.min(...ptos);
  const maxPto = Math.max(...ptos);

  // Score candidate windows
  const scoredWindows: CandidateWindow[] = candidatePool.map((cand) => {
    // 1. Price Index (lower price is better: 0-100)
    const priceIndex = normalizeScore(cand.estimatedTotalCost, minPrice, maxPrice, false);

    // 2. Weather Index (ideal temp proximity and low precip: 0-100)
    const tempQuality = Math.max(0, 100 - Math.abs(cand.weather.avgTempC - 26) * 6);
    const rainQuality = Math.max(0, 100 - cand.weather.precipitationRiskPercent * 2.5);
    const weatherIndex = Math.round((tempQuality * 0.6 + rainQuality * 0.4) * 10) / 10;

    // 3. PTO Efficiency (lower PTO consumed or higher ratio is better: 0-100)
    const ptoEfficiencyIndex = normalizeScore(cand.ptoDaysConsumed, minPto, maxPto, false);

    // 4. Travel Friction (arbitrage distance & friction: 0-100)
    // Non-arbitrage or close origin = low friction (higher score)
    const travelFrictionIndex = cand.isArbitrageOpportunity ? 75 : 95;

    // Multi-objective formula:
    // Score = (w1 * Price_Index) + (w2 * Weather_Index) + (w3 * PTO_Efficiency) - (w4 * (100 - Friction))
    // Or normalized:
    const finalScoreRaw =
      weights.w1_price * priceIndex +
      weights.w2_weather * weatherIndex +
      weights.w3_pto * ptoEfficiencyIndex +
      weights.w4_friction * travelFrictionIndex;

    const finalScore = Math.round(Math.min(100, Math.max(0, finalScoreRaw)) * 10) / 10;

    return {
      ...cand,
      scoreBreakdown: {
        priceIndex,
        weatherIndex,
        ptoEfficiencyIndex,
        travelFrictionIndex,
      },
      finalScore,
    };
  });

  // Rank by final score descending
  return scoredWindows.sort((a, b) => b.finalScore - a.finalScore);
}

