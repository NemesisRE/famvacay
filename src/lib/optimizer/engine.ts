import { addDays, parseISO, format, isAfter, differenceInYears } from 'date-fns';
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
import { SUPPORTED_ORIGIN_AIRPORTS } from './arbitrage';
import { POPULAR_DESTINATIONS, getEstimatedClimate, getDestinationSeasonalWarning } from './weather';
import { resolveDestinationCodes } from './destinations';
import { getAirportByIata, calculateGeodesicDistanceKm } from '../airports/airport-service';
import { getSynchronousTripPricing } from '../pricing/pricing-service';

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
 * Expands official school holiday intervals with adjacent weekends.
 * In European schools, if a break starts on Monday (or Tuesday), the preceding weekend is school-free.
 * If a break ends on Friday (or Thursday), the following weekend is school-free.
 */
export function expandSchoolHolidayWithWeekends(holiday: SchoolHoliday): { startDate: string; endDate: string } {
  let start = parseISO(holiday.startDate);
  let end = parseISO(holiday.endDate);

  const startDay = start.getDay(); // 0 is Sunday, 1 is Monday
  if (startDay === 1) {
    start = addDays(start, -2);
  } else if (startDay === 2) {
    start = addDays(start, -3);
  } else if (startDay === 0) {
    start = addDays(start, -1);
  }

  const endDay = end.getDay(); // 5 is Friday
  if (endDay === 5) {
    end = addDays(end, 2);
  } else if (endDay === 4) {
    end = addDays(end, 3);
  } else if (endDay === 6) {
    end = addDays(end, 1);
  }

  return {
    startDate: format(start, 'yyyy-MM-dd'),
    endDate: format(end, 'yyyy-MM-dd'),
  };
}

/**
 * Checks if [startStr, endStr] falls ENTIRELY inside at least one school holiday period.
 */
export function isWithinSchoolHoliday(
  startStr: string,
  endStr: string,
  holidays: SchoolHoliday[]
): boolean {
  if (holidays.length === 0) return true;

  const start = parseISO(startStr);
  const end = parseISO(endStr);

  for (const h of holidays) {
    const expanded = expandSchoolHolidayWithWeekends(h);
    const hStart = parseISO(expanded.startDate);
    const hEnd = parseISO(expanded.endDate);

    if (start >= hStart && end <= hEnd) {
      return true;
    }
  }
  return false;
}

export interface HolidayCoverageResult {
  isFullyInside: boolean;
  overlapDays: number;
  coverageRatio: number;
}

/**
 * Calculates school holiday coverage details for a candidate window.
 */
export function calculateHolidayCoverage(
  startStr: string,
  endStr: string,
  holidays: SchoolHoliday[]
): HolidayCoverageResult {
  if (holidays.length === 0) {
    return { isFullyInside: true, overlapDays: 0, coverageRatio: 1.0 };
  }

  const start = parseISO(startStr);
  const end = parseISO(endStr);
  const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);

  let isFullyInside = false;
  let maxOverlap = 0;

  for (const h of holidays) {
    const expanded = expandSchoolHolidayWithWeekends(h);
    const hStart = parseISO(expanded.startDate);
    const hEnd = parseISO(expanded.endDate);

    if (start >= hStart && end <= hEnd) {
      isFullyInside = true;
      maxOverlap = totalDays;
      break;
    }

    const overlapStart = start > hStart ? start : hStart;
    const overlapEnd = end < hEnd ? end : hEnd;
    if (overlapStart <= overlapEnd) {
      const days = Math.round((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      if (days > maxOverlap) {
        maxOverlap = days;
      }
    }
  }

  return {
    isFullyInside,
    overlapDays: maxOverlap,
    coverageRatio: Math.min(1.0, maxOverlap / totalDays),
  };
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
  if (max === min) return 80;
  const clamped = Math.max(min, Math.min(max, val));
  const ratio = (clamped - min) / (max - min);
  const score = higherIsBetter ? ratio * 100 : (1 - ratio) * 100;
  return Math.round(score * 10) / 10;
}

interface RawCandidate extends Omit<CandidateWindow, 'finalScore' | 'scoreBreakdown'> {
  holidayCoverage: HolidayCoverageResult;
  frictionBaseScore: number;
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
  const { userProfile, earliestDate, latestDate } = input;
  const minDuration = input.durationDaysMin || input.durationDays || 7;
  const maxDuration = Math.max(minDuration, input.durationDaysMax || input.durationDays || minDuration);

  // Merge profile blackouts and ad-hoc search blackouts
  const allBlackouts = [
    ...(userProfile.blackoutRanges || []),
    ...(input.searchBlackouts || []),
  ];

  const homeState = userProfile.federalState || 'DE-BW';
  const homeSchoolHolidays = schoolHolidaysByState[homeState] || [];
  const homePublicHolidays = publicHolidaysByState[homeState] || [];

  const originAirports =
    userProfile.originAirports && userProfile.originAirports.length > 0
      ? userProfile.originAirports
      : ['STR', 'FRA'];

  // Select candidate destination codes
  const hasUserSelectedDestinations = Boolean(
    (input.targetDestinations && input.targetDestinations.length > 0) || input.targetRegion
  );

  let candidateDestinations = resolveDestinationCodes(
    input.targetDestinations && input.targetDestinations.length > 0
      ? input.targetDestinations
      : input.targetRegion
      ? [input.targetRegion]
      : undefined
  );

  // STRICT FILTERING:
  // If the user explicitly filtered by destinations, results must be strictly bound to those destinations.
  // Never fall back to arbitrary default airports (e.g. PMI, AYT) if the selected destinations have no matches.
  if (hasUserSelectedDestinations && candidateDestinations.length === 0) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Optimizer] 0 candidates found: Specified destinations could not be resolved to candidate flight corridors.');
    }
    return [];
  }

  // If user chose open discovery (no destination tags), default to family vacation hubs
  if (!hasUserSelectedDestinations && (!candidateDestinations || candidateDestinations.length === 0)) {
    candidateDestinations = ['PMI', 'HER', 'AYT', 'HRG', 'BCN', 'AGP', 'FAO', 'DJE'];
  }

  const rawCandidatePool: RawCandidate[] = [];

  const earliest = parseISO(earliestDate);
  const latest = parseISO(latestDate);

  let totalWindowsChecked = 0;
  let blackoutFilteredCount = 0;

  // Generate candidate dates across flexible duration range
  for (let durationDays = minDuration; durationDays <= maxDuration; durationDays++) {
    let currentDate = earliest;
    while (true) {
      const windowEnd = addDays(currentDate, durationDays - 1);
      if (isAfter(windowEnd, latest)) {
        break;
      }

      totalWindowsChecked++;
      const startStr = format(currentDate, 'yyyy-MM-dd');
      const endStr = format(windowEnd, 'yyyy-MM-dd');
      const monthIndex = currentDate.getMonth();

      // Dynamic Age Calculation relative to window start date
      let currentChildrenAges = userProfile.childrenAges || [];
      if (Array.isArray(userProfile.childrenBirthDates) && userProfile.childrenBirthDates.length > 0) {
        currentChildrenAges = userProfile.childrenBirthDates.map((bDate) => {
          return Math.max(0, differenceInYears(currentDate, parseISO(bDate)));
        });
      }

      const hasSchoolKids = currentChildrenAges.some((age) => age >= 6);
      const pCostMultiplier = calculatePassengerCostMultiplier(2, currentChildrenAges);

      // 1. Blackout Filtering
      if (overlapsWithBlackout(startStr, endStr, allBlackouts)) {
        blackoutFilteredCount++;
        currentDate = addDays(currentDate, 1);
        continue;
      }

      // 2. School Holiday Coverage Evaluation
      const holidayCoverage = calculateHolidayCoverage(startStr, endStr, homeSchoolHolidays);

      // 3. PTO consumption calculation
      const ptoInfo = calculatePtoDaysConsumed(startStr, endStr, homePublicHolidays);

      // 4. Test each origin airport and destination combination
      for (const origin of originAirports) {
        const airportDetails = getAirportByIata(origin) || SUPPORTED_ORIGIN_AIRPORTS[origin];
        const airportState = airportDetails?.state || homeState;
        const isArbitrage = airportState !== homeState;

        // Arbitrage check: If departing from an airport in neighboring state/country, check if that state is NOT on holiday
        let arbitrageNote: string | undefined;
        let arbitrageState: string | undefined;

        if (isArbitrage) {
          const neighborHolidays = schoolHolidaysByState[airportState] || [];
          const neighborCoverage = calculateHolidayCoverage(startStr, endStr, neighborHolidays);
          if (!neighborCoverage.isFullyInside && neighborCoverage.overlapDays < durationDays / 2) {
            arbitrageNote = `Arbitrage opportunity: Depart from ${origin} (${airportState}) where schools are in session! Flight fares typically 25-45% lower.`;
            arbitrageState = airportState;
          }
        }

        // Travel friction calculation based on distance and profile maxDrivingHours
        let frictionBaseScore = isArbitrage ? 80 : 95;
        if (userProfile.maxDrivingHours && userProfile.departureLat && userProfile.departureLon) {
          const airportObj = getAirportByIata(origin);
          if (airportObj) {
            const distKm = calculateGeodesicDistanceKm(
              userProfile.departureLat,
              userProfile.departureLon,
              airportObj.lat,
              airportObj.lon
            );
            const maxDriveDist = userProfile.maxDrivingHours * 90; // ~90 km/h driving benchmark
            if (distKm > maxDriveDist) {
              const excess = distKm - maxDriveDist;
              frictionBaseScore = Math.max(30, frictionBaseScore - Math.round(excess / 15));
            }
          }
        }

        for (const dest of candidateDestinations) {
          // Weather assessment
          const weather = getEstimatedClimate(dest, monthIndex);
          const seasonalWarning = getDestinationSeasonalWarning(dest, monthIndex);

          // Modular Pricing Engine with deep-links and realistic quotes
          const pricingDetails = getSynchronousTripPricing({
            originAirport: origin,
            destinationAirport: dest,
            startDate: startStr,
            endDate: endStr,
            durationDays,
            party: {
              adults: 2,
              childrenAges: currentChildrenAges,
              cabinClass: (userProfile.preferredCabinClass as any) || 'ECONOMY',
            },
            isArbitrage: Boolean(arbitrageNote),
          });

          const totalCost = pricingDetails.totalCost;
          const perPersonCost = pricingDetails.pricePerPerson;

          // Budget check
          if (input.maxBudgetTotal && totalCost > input.maxBudgetTotal) {
            continue;
          }

          const ptoEfficiencyRatio = ptoInfo.ptoDaysConsumed > 0
            ? Math.round((durationDays / ptoInfo.ptoDaysConsumed) * 10) / 10
            : durationDays * 2;

          rawCandidatePool.push({
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
            isCachedBenchmark: pricingDetails.isCachedBenchmark,
            pricingDetails,
            weather,
            seasonalWarning,
            isArbitrageOpportunity: Boolean(arbitrageNote),
            arbitrageOriginState: arbitrageState,
            arbitrageNote,
            requiresSchoolExemption: false,
            schoolHolidayDaysOverlap: holidayCoverage.overlapDays,
            holidayCoverage,
            frictionBaseScore,
          });
        }
      }

      currentDate = addDays(currentDate, 1);
    }
  }

  // 5. Intelligent School Holiday Tiering & Fallback
  // If the family has school-age children, prioritize 100% enclosed windows.
  // If NO 100% enclosed windows exist in the requested date range / duration (e.g., 12-16 days during a 9-day Herbstferien),
  // do NOT return 0 results! Provide graceful fallback to best overlapping or available windows.
  let eligibleCandidates: RawCandidate[] = rawCandidatePool;

  const hasAnySchoolKids = (userProfile.childrenAges || []).some((a) => a >= 6);

  if (hasAnySchoolKids && homeSchoolHolidays.length > 0) {
    const fullHolidayMatches = rawCandidatePool.filter((c) => c.holidayCoverage.isFullyInside);

    if (fullHolidayMatches.length > 0) {
      eligibleCandidates = fullHolidayMatches;
    } else {
      // Graceful Fallback: Pick candidate windows that maximize holiday overlap
      // Mark as requiring school exemption
      const partialMatches = rawCandidatePool.filter((c) => c.holidayCoverage.overlapDays > 0);
      if (partialMatches.length > 0) {
        eligibleCandidates = partialMatches.map((c) => ({
          ...c,
          requiresSchoolExemption: true,
        }));
      } else {
        // If search window doesn't overlap any holidays at all, return available dates with exemption flag
        eligibleCandidates = rawCandidatePool.map((c) => ({
          ...c,
          requiresSchoolExemption: true,
        }));
      }

      if (process.env.NODE_ENV !== 'production') {
        console.warn(
          `[Optimizer] No 100% enclosed school holiday windows found for duration ${minDuration}-${maxDuration}d. Activated holiday overlap fallback with ${eligibleCandidates.length} windows.`
        );
      }
    }
  }

  if (eligibleCandidates.length === 0) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        `[Optimizer] 0 candidates found. Total checked: ${totalWindowsChecked}, Blackout filtered: ${blackoutFilteredCount}.`
      );
    }
    return [];
  }

  // Find min/max for dynamic normalizations
  const prices = eligibleCandidates.map((c) => c.estimatedTotalCost);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  const ptos = eligibleCandidates.map((c) => c.ptoDaysConsumed);
  const minPto = Math.min(...ptos);
  const maxPto = Math.max(...ptos);

  // Score candidate windows
  const scoredWindows: CandidateWindow[] = eligibleCandidates.map((cand) => {
    // 1. Price Index (lower price is better: 0-100)
    const priceIndex = normalizeScore(cand.estimatedTotalCost, minPrice, maxPrice, false);

    // 2. Weather Index (temperature comfort and rain risk: 0-100)
    let tempQuality = Math.max(10, 100 - Math.abs(cand.weather.avgTempC - 25) * 5);
    const rainQuality = Math.max(10, 100 - cand.weather.precipitationRiskPercent * 2);
    let weatherIndex = Math.round((tempQuality * 0.6 + rainQuality * 0.4) * 10) / 10;

    // Climate preference bonus / penalty
    if (userProfile.climatePreference === 'WARM' && cand.weather.avgTempC >= 23) {
      weatherIndex = Math.min(100, weatherIndex + 12);
    } else if (userProfile.climatePreference === 'COOL' && cand.weather.avgTempC <= 18) {
      weatherIndex = Math.min(100, weatherIndex + 12);
    } else if (userProfile.climatePreference === 'MODERATE' && cand.weather.avgTempC >= 18 && cand.weather.avgTempC <= 26) {
      weatherIndex = Math.min(100, weatherIndex + 8);
    }

    // 3. PTO Efficiency (lower PTO consumed is better: 0-100)
    const ptoEfficiencyIndex = normalizeScore(cand.ptoDaysConsumed, minPto, maxPto, false);

    // 4. Travel Friction (distance, driving hours, arbitrage: 0-100)
    const travelFrictionIndex = cand.frictionBaseScore;

    // Multi-objective formula:
    let finalScoreRaw =
      weights.w1_price * priceIndex +
      weights.w2_weather * weatherIndex +
      weights.w3_pto * ptoEfficiencyIndex +
      weights.w4_friction * travelFrictionIndex;

    // Penalty if window requires school exemption when user has school kids
    if (cand.requiresSchoolExemption) {
      const penalty = Math.round((1 - cand.holidayCoverage.coverageRatio) * 18);
      finalScoreRaw -= penalty;
    }

    const finalScore = Math.round(Math.min(100, Math.max(0, finalScoreRaw)) * 10) / 10;

    const { holidayCoverage, frictionBaseScore, ...cleanCand } = cand;

    return {
      ...cleanCand,
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
