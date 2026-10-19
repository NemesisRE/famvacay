import { addDays, parseISO, format, isAfter, differenceInYears } from 'date-fns';
import {
  TripPlanInput,
  CandidateWindow,
  PublicHoliday,
  SchoolHoliday,
  OptimizationWeights,
  DEFAULT_WEIGHTS,
  DestinationType,
  TravelVehicle,
} from './types';
import { calculatePtoDaysConsumed } from './pto-calculator';
import { calculatePassengerCostMultiplier } from './child-tiers';
import {
  POPULAR_DESTINATIONS,
  getEstimatedClimate,
  getDestinationSeasonalWarning,
  getIdealTemperatureBand,
  getDestinationProfile,
} from './weather';
import { resolveDestinationCodes, OriginContext, getDestinationVacationStyles } from './destinations';
import {
  getAirportByIata,
  calculateGeodesicDistanceKm,
  getMajorAirportsForCountry,
  getRecommendedAirportsForCoordinates,
} from '../airports/airport-service';
import { getCountryCodeFromSubdivision } from '../regions/subdivisions';
import { getSynchronousTripPricing } from '../pricing/pricing-service';
import { getAvailableVehicles, calculateVehicleMetrics } from './vehicles';
import { getDestinationSafetyAssessment } from '../safety/safety-service';

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

/**
 * Calculates travel friction for the flight corridor based on distance and vacation style.
 * Short regional hops minimize family travel fatigue and score highest.
 */
export function calculateFlightFrictionScore(
  flightDistKm?: number,
  isLongRangeSelected: boolean = false
): number {
  if (flightDistKm == null || flightDistKm <= 0) return 90;
  if (flightDistKm <= 950) {
    // Short convenient hop: 98 - 94
    return Math.max(94, Math.round(98 - (flightDistKm / 950) * 4));
  }
  if (flightDistKm <= 2000) {
    // Regional mid-haul: 94 - 86
    return Math.max(86, Math.round(94 - ((flightDistKm - 950) / 1050) * 8));
  }
  if (flightDistKm <= 3800) {
    // Extended mid-haul: 86 - 74
    return Math.max(74, Math.round(86 - ((flightDistKm - 2000) / 1800) * 12));
  }
  if (flightDistKm <= 6000) {
    // Transcontinental: 74 - 58
    return Math.max(58, Math.round(74 - ((flightDistKm - 3800) / 2200) * 16));
  }
  // Long-haul > 6000 km:
  if (isLongRangeSelected) {
    return Math.max(65, Math.round(80 - ((flightDistKm - 6000) / 4000) * 15));
  }
  return Math.max(35, Math.round(58 - ((flightDistKm - 6000) / 4000) * 23));
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

  const homeState = userProfile.federalState || '';
  const homeSchoolHolidays = homeState ? schoolHolidaysByState[homeState] || [] : [];
  const homePublicHolidays = homeState ? publicHolidaysByState[homeState] || [] : [];

  const originAirports =
    userProfile.originAirports && userProfile.originAirports.length > 0
      ? userProfile.originAirports
      : (userProfile.departureLat != null && userProfile.departureLon != null
          ? getRecommendedAirportsForCoordinates(userProfile.departureLat, userProfile.departureLon)
              .filter((a) => a.isMajorHub || (a.distanceKm || 0) <= 80)
              .slice(0, 3)
              .map((a) => a.code)
          : (homeState
              ? getMajorAirportsForCountry(getCountryCodeFromSubdivision(homeState)).slice(0, 3)
              : []));

  const selectedVehicles: TravelVehicle[] =
    input.travelVehicles && input.travelVehicles.length > 0
      ? input.travelVehicles
      : input.travelVehicle
      ? [input.travelVehicle]
      : ['PLANE'];

  const originContext: OriginContext = {
    departureLat: userProfile.departureLat,
    departureLon: userProfile.departureLon,
    country: homeState ? getCountryCodeFromSubdivision(homeState) : undefined,
    federalState: homeState,
    originAirports,
    travelVehicle: selectedVehicles[0],
    travelVehicles: selectedVehicles,
    minBeachTemp: input.minBeachTemp,
    requireSnow: input.requireSnow,
    earliestDate: input.earliestDate,
    latestDate: input.latestDate,
  };

  // Select candidate destination codes
  const hasUserSelectedDestinations = Boolean(
    (input.targetDestinations && input.targetDestinations.length > 0) || input.targetRegion
  );

  const selectedTypes: DestinationType[] =
    input.destinationTypes && input.destinationTypes.length > 0
      ? input.destinationTypes
      : input.destinationType
      ? [input.destinationType]
      : ['ALL'];

  let candidateDestinations = resolveDestinationCodes(
    input.targetDestinations && input.targetDestinations.length > 0
      ? input.targetDestinations
      : input.targetRegion
      ? [input.targetRegion]
      : undefined,
    selectedTypes,
    originContext
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

  // If user chose open discovery (no destination tags), ensure candidate destinations are populated
  if (!hasUserSelectedDestinations && (!candidateDestinations || candidateDestinations.length === 0)) {
    candidateDestinations = resolveDestinationCodes(undefined, selectedTypes, originContext);
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

      const adultsCount = typeof userProfile.adults === 'number' && userProfile.adults >= 1
        ? userProfile.adults
        : 2;
      const hasSchoolKids = currentChildrenAges.some((age) => age >= 6);
      const pCostMultiplier = calculatePassengerCostMultiplier(adultsCount, currentChildrenAges, {
        birthDates: userProfile.childrenBirthDates,
        outboundDate: startStr,
        returnDate: endStr,
      });

      // 1. Blackout Filtering
      if (overlapsWithBlackout(startStr, endStr, allBlackouts)) {
        blackoutFilteredCount++;
        currentDate = addDays(currentDate, 1);
        continue;
      }

      // 2. School Holiday Coverage Evaluation
      const holidayCoverage = calculateHolidayCoverage(startStr, endStr, homeSchoolHolidays);

      // 3. PTO consumption calculation with configurable workweek
      const ptoInfo = calculatePtoDaysConsumed(
        startStr,
        endStr,
        homePublicHolidays,
        (userProfile as any).workweekDays
      );

      // 4. Test each origin airport and destination combination
      for (const origin of originAirports) {
        const airportDetails = getAirportByIata(origin);
        const airportState = airportDetails?.state || homeState;
        const isArbitrage = airportState !== homeState;

        let originDistKm: number | undefined;
        let originDriveMins: number | undefined;
        if (userProfile.departureLat && userProfile.departureLon && airportDetails) {
          originDistKm = Math.round(
            calculateGeodesicDistanceKm(
              userProfile.departureLat,
              userProfile.departureLon,
              airportDetails.lat,
              airportDetails.lon
            )
          );
          originDriveMins = Math.round((originDistKm / 85) * 60);
        }

        const originName = airportDetails?.name
          ? (airportDetails.city ? `${airportDetails.name} (${airportDetails.city})` : airportDetails.name)
          : origin;
        const originCity = airportDetails?.city || origin;
        const originCountry = airportDetails?.country || '';
        const originHighSpeedRail = Boolean(airportDetails?.isHighSpeedRailConnected);

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

        // Travel friction calculation based on driving distance and profile maxDrivingHours
        let frictionDriveScore = isArbitrage ? 80 : 95;
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
              frictionDriveScore = Math.max(30, frictionDriveScore - Math.round(excess / 15));
            }
          }
        }

        for (const dest of candidateDestinations) {
          const destAirportObj = getAirportByIata(dest);
          let flightDistKm: number | undefined;
          let flightDurationMins: number | undefined;
          if (airportDetails && destAirportObj) {
            flightDistKm = Math.round(
              calculateGeodesicDistanceKm(
                airportDetails.lat,
                airportDetails.lon,
                destAirportObj.lat,
                destAirportObj.lon
              )
            );
            flightDurationMins = Math.round(35 + (flightDistKm / 820) * 60);
          }

          const isLongRangeSelected = selectedTypes.includes('LONGRANGE');
          const flightFrictionScore = calculateFlightFrictionScore(flightDistKm, isLongRangeSelected);
          const compositeFrictionScore = Math.round(frictionDriveScore * 0.4 + flightFrictionScore * 0.6);

          const destinationName = destAirportObj?.city && destAirportObj?.country
            ? `${destAirportObj.city}, ${destAirportObj.country}`
            : (destAirportObj?.name || dest);
          const destinationCity = destAirportObj?.city || destAirportObj?.name || dest;
          const destinationCountry = destAirportObj?.country || '';

          const originGeo = {
            lat: userProfile.departureLat ?? airportDetails?.lat ?? 49.0069,
            lon: userProfile.departureLon ?? airportDetails?.lon ?? 8.4037,
            countryCode: originCountry || (homeState ? getCountryCodeFromSubdivision(homeState) : undefined),
            state: airportState || homeState,
          };
          const destGeo = {
            lat: destAirportObj?.lat ?? 0,
            lon: destAirportObj?.lon ?? 0,
            countryCode: destAirportObj?.state ? destAirportObj.state.split('-')[0] : undefined,
            state: destAirportObj?.state,
            code: dest,
            isHighSpeedRailConnected: destAirportObj?.isHighSpeedRailConnected,
          };

          const directDist = flightDistKm || (airportDetails && destAirportObj ? Math.round(calculateGeodesicDistanceKm(originGeo.lat, originGeo.lon, destGeo.lat, destGeo.lon)) : 500);
          const availableVehicles = getAvailableVehicles(originGeo, destGeo, directDist);
          const matchingVehicles = availableVehicles.filter((v) => selectedVehicles.includes(v));

          // Destination must be physically viable for at least one of the user's selected vehicles
          if (matchingVehicles.length === 0) {
            continue;
          }

          // Choose the most appropriate active vehicle among matching options:
          // For shorter distances, prefer Train/Car if selected by user; for longer hops, prefer Plane
          let activeVehicle: TravelVehicle = matchingVehicles[0];
          if (matchingVehicles.includes('TRAIN') && (destAirportObj?.isHighSpeedRailConnected || directDist <= 450)) {
            activeVehicle = 'TRAIN';
          } else if (matchingVehicles.includes('CAR') && directDist <= 550 && !matchingVehicles.includes('TRAIN')) {
            activeVehicle = 'CAR';
          } else if (matchingVehicles.includes('PLANE') && directDist >= 650) {
            activeVehicle = 'PLANE';
          }

          const vehicleDetails = calculateVehicleMetrics(
            activeVehicle,
            directDist,
            pCostMultiplier,
            destAirportObj?.isHighSpeedRailConnected
          );

          // Non-flight transit duration filter
          if (
            activeVehicle !== 'PLANE' &&
            input.maxOverlandTravelMinutes &&
            vehicleDetails.durationMinutes > input.maxOverlandTravelMinutes
          ) {
            continue;
          }

          // Dynamic weather assessment
          const weather = getEstimatedClimate(dest, monthIndex);
          const travelYear = parseInt(startStr.split('-')[0], 10) || 2026;
          const seasonalWarning = getDestinationSeasonalWarning(dest, monthIndex, {
            year: travelYear,
            weatherAssessment: weather,
          });

          // Minimum beach temperature constraint
          if (input.minBeachTemp && input.minBeachTemp > 0) {
            const isBeachCandidate = selectedTypes.includes('BEACH') ||
              (hasUserSelectedDestinations && getDestinationVacationStyles(dest).includes('BEACH'));
            if (isBeachCandidate) {
              const dayTemp = weather.maxTempC ?? weather.avgTempC;
              if (dayTemp < input.minBeachTemp) {
                continue; // Destination window too cold for user's minimum beach temperature
              }
            }
          }

          // Winter sports & snow guarantee constraint
          if (input.requireSnow) {
            const isAlpineCandidate = selectedTypes.includes('ALPINE') ||
              (hasUserSelectedDestinations && getDestinationVacationStyles(dest).includes('ALPINE'));
            if (isAlpineCandidate) {
              const altMeters = (destAirportObj?.altitude || 0) * 0.3048;
              const isWinterSeason = (destAirportObj?.lat || 0) >= 0
                ? (monthIndex === 11 || monthIndex <= 3)
                : (monthIndex >= 5 && monthIndex <= 9);
              const hasFreezingTemps = weather.avgTempC <= 3 || (weather.minTempC != null && weather.minTempC <= 0);
              const hasSnowConditions = isWinterSeason && hasFreezingTemps && (altMeters >= 450 || (destAirportObj?.keywords && /ski|snow|alps|dolomites|tirol/i.test(destAirportObj.keywords)));
              if (!hasSnowConditions) {
                continue; // No snow / winter sports conditions during this window
              }
            }
          }

          // Modular Pricing Engine with deep-links, realistic quotes, and board type modeling
          const pricingDetails = getSynchronousTripPricing({
            originAirport: origin,
            destinationAirport: dest,
            startDate: startStr,
            endDate: endStr,
            durationDays,
            party: {
              adults: adultsCount,
              childrenAges: currentChildrenAges,
              cabinClass: (userProfile.preferredCabinClass as any) || 'ECONOMY',
            },
            isArbitrage: Boolean(arbitrageNote),
            preferredBoardType: input.preferredBoardType,
          });

          let totalCost = pricingDetails.totalCost;
          let perPersonCost = pricingDetails.pricePerPerson;

          if (activeVehicle !== 'PLANE') {
            const travelCost = vehicleDetails.estimatedTravelCost;
            totalCost = travelCost + pricingDetails.lodging.totalLodgingCost;
            perPersonCost = Math.round(totalCost / Math.max(1, adultsCount + currentChildrenAges.length));
            pricingDetails.flight.totalFlightCost = travelCost;
            pricingDetails.flight.baseAdultFare = Math.round(travelCost / pCostMultiplier);
            pricingDetails.totalCost = totalCost;
            pricingDetails.pricePerPerson = perPersonCost;
          }

          const effectiveCost =
            pricingDetails.effectiveCost ??
            Math.max(0, totalCost - Math.round((pricingDetails.mealPlanValue || 0) * 0.75));

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
            destinationName,
            destinationCity,
            destinationCountry,
            originName,
            originCity,
            originCountry,
            flightDistanceKm: flightDistKm,
            flightDurationMinutes: flightDurationMins,
            originDistanceKm: originDistKm,
            originDriveMinutes: originDriveMins,
            originHighSpeedRail,
            totalWeekdays: ptoInfo.totalWeekdays,
            publicHolidaysCount: ptoInfo.publicHolidaysCount,
            ptoDaysConsumed: ptoInfo.ptoDaysConsumed,
            ptoEfficiencyRatio,
            suggestedShifts: ptoInfo.suggestedShifts,
            estimatedTotalCost: totalCost,
            pricePerPerson: perPersonCost,
            isCachedBenchmark: pricingDetails.isCachedBenchmark,
            pricingDetails,
            boardType: pricingDetails.boardType,
            mealPlanValue: pricingDetails.mealPlanValue,
            effectiveCost,
            weather,
            seasonalWarning,
            isArbitrageOpportunity: Boolean(arbitrageNote),
            arbitrageOriginState: arbitrageState,
            arbitrageNote,
            requiresSchoolExemption: false,
            schoolHolidayDaysOverlap: holidayCoverage.overlapDays,
            holidayCoverage,
            frictionBaseScore: compositeFrictionScore,
            travelVehicle: activeVehicle,
            availableVehicles,
            vehicleDetails,
          });
        }
      }

      currentDate = addDays(currentDate, 1);
    }
  }

  // 5. Intelligent School Holiday Tiering & Fallback
  // If the family has school-age children:
  // - If input.strictSchoolHolidays is true: strictly enforce 100% enclosed school holiday windows (or graceful fallback).
  // - If input.strictSchoolHolidays is false/omitted (default open discovery): keep candidates across the full date range,
  //   marking non-enclosed windows with requiresSchoolExemption = true so they receive the score penalty without discarding entire months.
  let eligibleCandidates: RawCandidate[] = rawCandidatePool;

  const hasAnySchoolKids = (userProfile.childrenAges || []).some((a) => a >= 6);

  if (hasAnySchoolKids && homeSchoolHolidays.length > 0) {
    if (input.strictSchoolHolidays) {
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
    } else {
      // Open multi-month exploration: retain candidates across the requested date window,
      // flagging any window that isn't fully inside school holidays as requiring exemption.
      eligibleCandidates = rawCandidatePool.map((c) => {
        if (!c.holidayCoverage.isFullyInside) {
          return {
            ...c,
            requiresSchoolExemption: true,
          };
        }
        return c;
      });
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

  // Find min/max for dynamic normalizations (factoring in meal plan value for fair comparisons)
  const effectiveCosts = eligibleCandidates.map((c) => c.effectiveCost ?? c.estimatedTotalCost);
  const minCost = Math.min(...effectiveCosts);
  const maxCost = Math.max(...effectiveCosts);

  const ptos = eligibleCandidates.map((c) => c.ptoDaysConsumed);
  const minPto = Math.min(...ptos);
  const maxPto = Math.max(...ptos);

  // Score candidate windows
  const scoredWindows: CandidateWindow[] = eligibleCandidates.map((cand) => {
    // 1. Price Index factoring in meal plan value (lower effective cost is better: 0-100)
    const priceIndex = normalizeScore(cand.effectiveCost ?? cand.estimatedTotalCost, minCost, maxCost, false);

    // 2. Weather Index (temperature comfort calibrated to vacation style and rain risk: 0-100)
    const monthIndex = parseISO(cand.startDate).getMonth();
    const profile = getDestinationProfile(cand.destinationAirport);
    const effectiveTypes = hasUserSelectedDestinations
      ? (profile?.type ? [profile.type] : selectedTypes)
      : selectedTypes;
    const tempBand = getIdealTemperatureBand(cand.destinationAirport, monthIndex, effectiveTypes);
    let tempDiff = 0;
    if (cand.weather.avgTempC < tempBand.minIdeal) {
      tempDiff = tempBand.minIdeal - cand.weather.avgTempC;
    } else if (cand.weather.avgTempC > tempBand.maxIdeal) {
      tempDiff = cand.weather.avgTempC - tempBand.maxIdeal;
    }
    const tempQuality = Math.max(10, Math.round(100 - tempDiff * 4.5));
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

    if (input.minBeachTemp && cand.weather.avgTempC >= input.minBeachTemp) {
      weatherIndex = Math.min(100, weatherIndex + 10);
    }
    if (input.requireSnow && cand.weather.hasSnow) {
      weatherIndex = Math.min(100, weatherIndex + 12);
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

    const safetyAssessment = getDestinationSafetyAssessment(
      cand.destinationAirport,
      cand.destinationCountry || ''
    );

    return {
      ...cleanCand,
      destinationSafety: safetyAssessment,
      safetyAssessment,
      scoreBreakdown: {
        priceIndex,
        weatherIndex,
        ptoEfficiencyIndex,
        travelFrictionIndex,
      },
      finalScore,
    };
  });

  // Interleave distinct destinations to ensure balanced discovery across pages
  return interleaveCandidateWindowsByDestination(scoredWindows);
}

/**
 * Interleaves candidate windows across distinct destinations so results showcase a diverse
 * variety of destinations on every page rather than 50 consecutive windows of one destination.
 */
export function interleaveCandidateWindowsByDestination(
  windows: CandidateWindow[]
): CandidateWindow[] {
  const destinations = new Set(windows.map((w) => w.destinationAirport));
  if (destinations.size <= 1) {
    return windows.sort((a, b) => b.finalScore - a.finalScore);
  }

  // Group windows by destination airport, each sorted by finalScore desc
  const byDestination = new Map<string, CandidateWindow[]>();
  for (const w of windows) {
    const list = byDestination.get(w.destinationAirport) || [];
    list.push(w);
    byDestination.set(w.destinationAirport, list);
  }
  for (const [_, list] of byDestination.entries()) {
    list.sort((a, b) => b.finalScore - a.finalScore);
  }

  // Sort destination buckets by their highest-scoring window
  const sortedDestKeys = Array.from(byDestination.keys()).sort((k1, k2) => {
    const top1 = byDestination.get(k1)![0].finalScore;
    const top2 = byDestination.get(k2)![0].finalScore;
    return top2 - top1;
  });

  // Round-robin interleave across destinations
  const result: CandidateWindow[] = [];
  let round = 0;
  let hasMore = true;

  while (hasMore) {
    hasMore = false;
    for (const key of sortedDestKeys) {
      const list = byDestination.get(key)!;
      if (round < list.length) {
        result.push(list[round]);
        if (round + 1 < list.length) {
          hasMore = true;
        }
      }
    }
    round++;
  }

  return result;
}

/**
 * Curates a distinct, non-redundant set of alternative vacation date windows.
 * Eliminates noisy +1 day shifts and overlapping windows from the same origin.
 * Surfaces key vacation milestones:
 * 1. Absolute Lowest Price Deal (e.g. Midweek departure savings)
 * 2. Peak PTO Efficiency (bridge day / holiday savings)
 * 3. 100% School Holiday Window (if applicable)
 * 4. Alternative Origin Airport options (e.g. FKB vs STR vs FRA)
 * 5. Distinct travel periods across the search months
 */
export { curateDistinctAlternativeWindows } from './curation';
