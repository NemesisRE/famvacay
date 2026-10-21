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
import { calculateEffectivePtoDaysConsumed, ChildcareClosurePeriod } from './pto-calculator';
import { applyChildcareArbitrageWarnings } from './childcare-arbitrage';
import { calculatePassengerCostMultiplier } from './child-tiers';
import {
  POPULAR_DESTINATIONS,
  getEstimatedClimate,
  getDestinationSeasonalWarning,
  getIdealTemperatureBand,
  getDestinationProfile,
  getSeasonalWarningPenalty,
} from './weather';
import { resolveDestinationCodes, OriginContext, getDestinationVacationStyles } from './destinations';
import {
  getAirportByIata,
  calculateGeodesicDistanceKm,
  getMajorAirportsForCountry,
  getRecommendedAirportsForCoordinates,
} from '../airports/airport-service';
import { resolveFlightRoute, FlightRouteDetails } from '../airports/flight-routes';
import { getCountryCodeFromSubdivision } from '../regions/subdivisions';
import { getSynchronousTripPricing } from '../pricing/pricing-service';
import { getAvailableVehicles, calculateVehicleMetrics, classifyOverlandAccess, estimateUtcOffsetHours } from './vehicles';
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
 * Calculates travel friction for the flight corridor based on distance, vacation style,
 * and flight connections / layovers. Short regional hops and direct flights minimize family travel
 * fatigue and score highest, while layovers/transfers apply proportional convenience friction penalties.
 */
export function calculateFlightFrictionScore(
  flightDistKm?: number,
  isLongRangeSelected: boolean = false,
  stops: number = 0,
  layoverMinutes: number = 0
): number {
  if (flightDistKm == null || flightDistKm <= 0) return 90;
  let score = 90;
  if (flightDistKm <= 950) {
    // Short convenient hop: 98 - 94
    score = Math.max(94, Math.round(98 - (flightDistKm / 950) * 4));
  } else if (flightDistKm <= 2000) {
    // Regional mid-haul: 94 - 86
    score = Math.max(86, Math.round(94 - ((flightDistKm - 950) / 1050) * 8));
  } else if (flightDistKm <= 3800) {
    // Extended mid-haul: 86 - 74
    score = Math.max(74, Math.round(86 - ((flightDistKm - 2000) / 1800) * 12));
  } else if (flightDistKm <= 6000) {
    // Transcontinental: 74 - 58
    score = Math.max(58, Math.round(74 - ((flightDistKm - 3800) / 2200) * 16));
  } else if (isLongRangeSelected) {
    // Long-haul > 6000 km:
    score = Math.max(65, Math.round(80 - ((flightDistKm - 6000) / 4000) * 15));
  } else {
    score = Math.max(35, Math.round(58 - ((flightDistKm - 6000) / 4000) * 23));
  }

  // Layover-weighted convenience friction penalty (more transfers = proportionally lower score)
  if (stops === 1) {
    const extraDurationPenalty = Math.max(0, Math.round((layoverMinutes - 90) / 30) * 2);
    score = Math.max(20, score - 16 - extraDurationPenalty);
  } else if (stops >= 2) {
    const extraDurationPenalty = Math.max(0, Math.round((layoverMinutes - 150) / 30) * 3);
    score = Math.max(10, score - 32 - extraDurationPenalty);
  }

  return score;
}

interface RawCandidate extends Omit<CandidateWindow, 'finalScore' | 'scoreBreakdown'> {
  holidayCoverage: HolidayCoverageResult;
  frictionBaseScore: number;
  flightRoute?: FlightRouteDetails;
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

  // STRICT_BLACKOUT periods remain a hard candidate filter (work lockouts, weddings).
  // CHILDCARE_CLOSURE periods are never filtered out - they reduce *effective* marginal PTO
  // consumed instead (see calculateEffectivePtoDaysConsumed), since parents must take time
  // off during a mandatory daycare closure whether or not they travel.
  const strictBlackouts = allBlackouts.filter((b) => (b.type || 'STRICT_BLACKOUT') === 'STRICT_BLACKOUT');
  const childcareClosures: ChildcareClosurePeriod[] = allBlackouts
    .filter((b) => b.type === 'CHILDCARE_CLOSURE')
    .map((b) => ({
      startDate: b.startDate,
      endDate: b.endDate,
      coverageFactor: typeof b.coverageFactor === 'number' ? b.coverageFactor : 1.0,
    }));

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
      const hasYoungChild = currentChildrenAges.some((age) => age < 6);
      const pCostMultiplier = calculatePassengerCostMultiplier(adultsCount, currentChildrenAges, {
        birthDates: userProfile.childrenBirthDates,
        outboundDate: startStr,
        returnDate: endStr,
      });

      // 1. Blackout Filtering (STRICT_BLACKOUT only - CHILDCARE_CLOSURE never filters candidates)
      if (overlapsWithBlackout(startStr, endStr, strictBlackouts)) {
        blackoutFilteredCount++;
        currentDate = addDays(currentDate, 1);
        continue;
      }

      // 2. School Holiday Coverage Evaluation
      const holidayCoverage = calculateHolidayCoverage(startStr, endStr, homeSchoolHolidays);

      // 3. PTO consumption calculation with configurable workweek, factoring in effective
      // marginal PTO consumed when a CHILDCARE_CLOSURE period overlaps this window.
      const ptoInfo = calculateEffectivePtoDaysConsumed(
        startStr,
        endStr,
        homePublicHolidays,
        (userProfile as any).workweekDays,
        childcareClosures
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

        // Baseline travel friction score (lower for arbitrage/out-of-state departures)
        const frictionDriveScore = isArbitrage ? 80 : 95;

        for (const dest of candidateDestinations) {
          const destAirportObj = getAirportByIata(dest);

          // Flight route logistics: direct vs connecting, layovers, and transfer hubs
          const flightRoute = resolveFlightRoute(origin, dest);

          // Flight transit tolerance filter (direct flights only vs max 1 stop vs any)
          const maxToleratedStops = input.maxFlightStops ?? userProfile.maxFlightStops;
          if (maxToleratedStops !== undefined && flightRoute.stops > maxToleratedStops) {
            // If user's selected mode is strictly PLANE or route is only viable by air, filter out
            if (selectedVehicles.length === 1 && selectedVehicles[0] === 'PLANE') {
              continue;
            }
          }

          let flightDistKm: number | undefined = flightRoute.flightDistanceKm;
          let flightDurationMins: number | undefined = flightRoute.totalFlightDurationMinutes;

          const isLongRangeSelected = selectedTypes.includes('LONGRANGE');
          const flightFrictionScore = calculateFlightFrictionScore(
            flightDistKm,
            isLongRangeSelected,
            flightRoute.stops,
            flightRoute.totalLayoverMinutes
          );
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

          // Biological toddler friction: young children (<=4y) + a significant timezone shift
          // on a short trip (< 10 days) compound travel fatigue disproportionately.
          const hasToddler = currentChildrenAges.some((age) => age <= 4);
          const utcShiftHours = Math.abs(estimateUtcOffsetHours(destGeo.lon) - estimateUtcOffsetHours(originGeo.lon));
          const jetlagPenalty = hasToddler && utcShiftHours >= 3 && durationDays < 10
            ? Math.round(utcShiftHours * 2.5 * (10 / durationDays) * 10) / 10
            : 0;

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

          // Flight transit tolerance filter (direct flights only vs max 1 stop vs any)
          if (activeVehicle === 'PLANE' && maxToleratedStops !== undefined && flightRoute.stops > maxToleratedStops) {
            continue;
          }

          const ferryAccess = classifyOverlandAccess(destGeo);

          const vehicleDetails = calculateVehicleMetrics(
            activeVehicle,
            directDist,
            pCostMultiplier,
            destAirportObj?.isHighSpeedRailConnected,
            activeVehicle !== 'PLANE' ? ferryAccess : undefined
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

          // Long-range & exotic category exclusion when not selected by user
          if (
            !hasUserSelectedDestinations &&
            !selectedTypes.includes('ALL') &&
            !selectedTypes.includes('LONGRANGE') &&
            (directDist >= 3500 || getDestinationVacationStyles(dest, directDist).includes('LONGRANGE'))
          ) {
            continue; // Destination belongs to long-range/exotic category which was not selected
          }

          // Climate preference constraint: avoid extreme heat (>38°C)
          if (input.avoidExtremeHeat && seasonalWarning?.seasonType === 'EXTREME_HEAT') {
            continue; // Filtered out by user's extreme heat avoidance constraint
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

          const ptoEfficiencyRatio = ptoInfo.effectivePtoDaysConsumed > 0
            ? Math.round((durationDays / ptoInfo.effectivePtoDaysConsumed) * 10) / 10
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
            isDirectFlight: activeVehicle === 'PLANE' ? flightRoute.isDirect : undefined,
            flightStops: activeVehicle === 'PLANE' ? flightRoute.stops : undefined,
            flightLayovers: activeVehicle === 'PLANE' ? flightRoute.layovers : undefined,
            flightSegments: activeVehicle === 'PLANE' ? flightRoute.segments : undefined,
            directFlightPremium: activeVehicle === 'PLANE' && flightRoute.isDirect ? flightRoute.directFlightPremiumMultiplier : undefined,
            layoverPenalty: activeVehicle === 'PLANE' ? flightRoute.layoverScorePenalty : 0,
            flightRoute: activeVehicle === 'PLANE' ? flightRoute : undefined,
            totalWeekdays: ptoInfo.totalWeekdays,
            publicHolidaysCount: ptoInfo.publicHolidaysCount,
            ptoDaysConsumed: ptoInfo.effectivePtoDaysConsumed,
            rawPtoDaysConsumed: ptoInfo.ptoDaysConsumed,
            overlapsChildcareClosure: ptoInfo.overlappingClosureWeekdays > 0,
            hasYoungChildAtDeparture: hasYoungChild,
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
            frictionBaseScore: Math.max(5, compositeFrictionScore - jetlagPenalty),
            travelVehicle: activeVehicle,
            availableVehicles,
            vehicleDetails,
            overlandAccess: activeVehicle !== 'PLANE' ? ferryAccess.access : undefined,
            ferrySurchargeEur: activeVehicle !== 'PLANE' ? ferryAccess.ferrySurchargeEur : undefined,
            ferryTransitMinutes: activeVehicle !== 'PLANE' ? ferryAccess.ferryTransitMinutes : undefined,
            jetlagPenalty: jetlagPenalty > 0 ? jetlagPenalty : undefined,
            parkSleepFlyRecommended: activeVehicle === 'PLANE' && (originDriveMins || 0) > 90,
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

  // 5b. Childcare Closure vs. Peak Season Arbitrage
  // For windows overlapping a CHILDCARE_CLOSURE where the family has a daycare-age child
  // (< 6y at departure), compare against the cheapest off-peak alternative for the same
  // destination & duration. Warn when the peak-season premium per saved PTO day is steep.
  if (childcareClosures.length > 0) {
    applyChildcareArbitrageWarnings(eligibleCandidates);
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

    if (input.minBeachTemp && cand.weather.avgTempC >= input.minBeachTemp) {
      weatherIndex = Math.min(100, weatherIndex + 10);
    }
    if (input.requireSnow && cand.weather.hasSnow) {
      weatherIndex = Math.min(100, weatherIndex + 12);
    }

    // Active seasonal warnings and local environmental phenomena:
    // Degrades weather comfort index to reflect compromised vacation conditions (algae blooms, insect plagues, extreme weather)
    // Extreme summer heat is a user-configurable preference rather than an unconditional global penalty.
    const seasonalImpact = getSeasonalWarningPenalty(cand.seasonalWarning, {
      avoidExtremeHeat: input.avoidExtremeHeat,
    });
    if (seasonalImpact) {
      weatherIndex = Math.max(5, Math.round((weatherIndex - seasonalImpact.weatherPenalty) * 10) / 10);
    }

    // 3. PTO Efficiency & Trip Duration Dynamics
    // Short trips (<= 7 days): Weight efficiency higher when fewer PTO days consumed (bridge days / weekends leverage).
    // Longer trips (> 7 days): Prioritize price advantage and cost savings rather than pure PTO minimization.
    let ptoEfficiencyIndex: number;
    let candWeights = weights;

    if (cand.durationDays <= 7) {
      // Short trip: high efficiency weighting
      candWeights = {
        w1_price: 0.28,
        w2_weather: 0.24,
        w3_pto: 0.38,
        w4_friction: 0.10,
      };
      if (cand.ptoDaysConsumed === 0) {
        ptoEfficiencyIndex = 100;
      } else if (cand.ptoEfficiencyRatio >= 3.0) {
        ptoEfficiencyIndex = Math.min(100, 92 + Math.round((cand.ptoEfficiencyRatio - 3.0) * 4));
      } else {
        ptoEfficiencyIndex = normalizeScore(cand.ptoDaysConsumed, minPto, maxPto, false);
      }
    } else {
      // Longer trip (> 7 days): prioritize price advantage and cost savings gained from specific travel window
      candWeights = {
        w1_price: 0.45,
        w2_weather: 0.30,
        w3_pto: 0.15,
        w4_friction: 0.10,
      };
      // For longer trips, evaluate free-day leverage (weekends & holidays) rather than pure PTO minimization
      const freeDaysGained = Math.max(0, cand.durationDays - cand.ptoDaysConsumed);
      const freeRatio = freeDaysGained / cand.durationDays;
      ptoEfficiencyIndex = Math.min(100, Math.max(55, Math.round(65 + freeRatio * 55)));
    }

    // Prevent PtoIndex from blindly dominating PriceIndex when the childcare closure
    // arbitrage opportunity cost exceeds EUR 150/saved-PTO-day: dampen its weighted contribution.
    if (cand.childcareArbitrageWarning) {
      ptoEfficiencyIndex = Math.round(ptoEfficiencyIndex * 0.6 * 10) / 10;
    }

    // 4. Travel Friction (distance, driving hours, layovers, arbitrage: 0-100)
    const travelFrictionIndex = cand.frictionBaseScore;

    // Multi-objective formula with duration-adaptive weights:
    let finalScoreRaw =
      candWeights.w1_price * priceIndex +
      candWeights.w2_weather * weatherIndex +
      candWeights.w3_pto * ptoEfficiencyIndex +
      candWeights.w4_friction * travelFrictionIndex;

    // 5. Off-Peak Score Bonus (global/multi-country school holiday rhythm & childless preference)
    const startObj = parseISO(cand.startDate);
    const mNum = startObj.getMonth() + 1; // 1-12
    const dNum = startObj.getDate();
    const isPeakSummer = mNum === 7 || mNum === 8;
    const isPeakChristmas = (mNum === 12 && dNum >= 20) || (mNum === 1 && dNum <= 6);
    const isGlobalHighPeak = isPeakSummer || isPeakChristmas;

    let offPeakBonus = 0;
    if (!hasAnySchoolKids) {
      // For parties traveling without children / school dependents: explicit bonus outside public holidays and school vacations
      const isOutsideSchoolHolidays = cand.holidayCoverage.overlapDays === 0;
      const isOutsidePublicHolidays = cand.publicHolidaysCount === 0;
      if (isOutsideSchoolHolidays && !isGlobalHighPeak) {
        offPeakBonus = isOutsidePublicHolidays ? 10 : 7;
      } else if (isOutsideSchoolHolidays) {
        offPeakBonus = 5;
      }
    } else {
      // For school families: bonus if window is in a multi-market shoulder window outside European high peak
      if (!isGlobalHighPeak && cand.holidayCoverage.isFullyInside) {
        offPeakBonus = 5;
      }
    }
    finalScoreRaw += offPeakBonus;

    // 6. Value-for-Money / Duration Bonus
    // Awarded when a user can travel for a longer duration at equal or lower total cost compared to shorter peak alternatives
    let valueForMoneyBonus = 0;
    const candTotalCost = cand.effectiveCost ?? cand.estimatedTotalCost;
    const shorterAlternatives = eligibleCandidates.filter(
      (o) => o.destinationAirport === cand.destinationAirport && o.durationDays < cand.durationDays
    );
    if (shorterAlternatives.length > 0) {
      const cheaperThanOrEqualShorter = shorterAlternatives.some(
        (s) => (s.effectiveCost ?? s.estimatedTotalCost) >= candTotalCost
      );
      if (cheaperThanOrEqualShorter) {
        valueForMoneyBonus = 8;
      } else {
        const candDaily = candTotalCost / cand.durationDays;
        const avgShorterDaily =
          shorterAlternatives.reduce((acc, s) => acc + (s.effectiveCost ?? s.estimatedTotalCost) / s.durationDays, 0) /
          shorterAlternatives.length;
        if (candDaily < avgShorterDaily * 0.80) {
          valueForMoneyBonus = 5;
        }
      }
    }
    finalScoreRaw += valueForMoneyBonus;

    // Layover-weighted scoring penalty on overall score ("vacation factor"):
    // More transfers / connections = proportionally lower convenience & match score
    if (cand.flightStops && cand.flightStops > 0) {
      const layoverScoreDeduction = cand.layoverPenalty ?? (cand.flightStops === 1 ? 5 : 12);
      finalScoreRaw -= layoverScoreDeduction;
    }

    // Active seasonal warnings & local environmental phenomena penalty on overall score ("vacation factor"):
    if (seasonalImpact) {
      finalScoreRaw -= seasonalImpact.overallScorePenalty;
    }

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
      seasonalWarningImpact: seasonalImpact,
      seasonalWarningPenalty: seasonalImpact?.overallScorePenalty || 0,
      layoverPenalty: cand.layoverPenalty || 0,
      isOffPeak: offPeakBonus >= 5,
      offPeakBonus: offPeakBonus > 0 ? offPeakBonus : undefined,
      valueForMoneyBonus: valueForMoneyBonus > 0 ? valueForMoneyBonus : undefined,
      scoreBreakdown: {
        priceIndex,
        weatherIndex,
        ptoEfficiencyIndex,
        travelFrictionIndex,
        offPeakBonus: offPeakBonus > 0 ? offPeakBonus : undefined,
        valueForMoneyBonus: valueForMoneyBonus > 0 ? valueForMoneyBonus : undefined,
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
