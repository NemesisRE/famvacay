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
  WeatherAssessment,
} from './types';
import { calculateEffectivePtoDaysConsumed, ChildcareClosurePeriod } from './pto-calculator';
import { applyChildcareArbitrageWarnings } from './childcare-arbitrage';
import { calculatePassengerCostMultiplier } from './child-tiers';
import {
  getEstimatedClimate,
  getDestinationSeasonalWarning,
  getIdealTemperatureBand,
  getDestinationProfile,
  getSeasonalWarningPenalty,
  type SeasonalConstraintWarning,
} from './weather';
import {
  resolveDestinationCodes,
  resolveOriginCoordinates,
  OriginContext,
  getDestinationVacationStyles,
} from './destinations';
import {
  getAirportByIata,
  calculateGeodesicDistanceKm,
  getMajorAirportsForCountry,
  getRecommendedAirportsForCoordinates,
  type DynamicAirport,
} from '../airports/airport-service';
import { getDestinationPoint, type DestinationPoint } from '../geo/destination-points';
import type { AggregatedTripPricing } from '../pricing/types';
import { resolveFlightRoute, FlightRouteDetails, PRIMARY_GATEWAY_HUBS, resolveFlexOriginAirports } from '../airports/flight-routes';
import {
  buildSourceMarketDemandTimeline,
  HIGH_DEMAND_THRESHOLD,
  MAX_DEMAND_SURCHARGE,
  type MarketHolidayCalendar,
  type SourceMarketDemand,
  type SourceMarketDemandTimeline,
} from '../holidays/source-markets';
import { getCountryCodeFromSubdivision } from '../regions/subdivisions';
import { getSynchronousTripPricing } from '../pricing/pricing-service';
import {
  getAvailableVehicles,
  calculateVehicleMetrics,
  classifyOverlandAccess,
  estimateUtcOffsetHours,
  isOverlandVehicleInRange,
  isOverlandReachable,
  calculateOverlandFrictionScore,
  type OverlandAccessResult,
} from './vehicles';
import { getDestinationSafetyAssessment, isDestinationBanned } from '../safety/advisory-store';

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
  } else {
    // Long-haul > 6000 km: a destination that genuinely requires this distance (Sydney, Bali,
    // Mauritius, Buenos Aires, ...) is scored on its own curve regardless of which vacation-style
    // filter the user happened to pick - it used to only get this fair curve when the user had
    // explicitly selected "Long-range", so under the default "All styles" search every long-haul
    // destination was scored as if it were an accidental detour and buried at the bottom of the
    // (score-sorted, paginated) results.
    score = Math.max(65, Math.round(80 - ((flightDistKm - 6000) / 4000) * 15));
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
}

/**
 * Origin code used for overland (car/train/bus) candidates: those trips start at the family's
 * home address, not at any airport.
 */
export const OVERLAND_ORIGIN_CODE = 'HOME';

type OverlandVehicle = Exclude<TravelVehicle, 'PLANE'>;

/**
 * Below this home-to-destination distance a flight is not offered when the destination can be
 * reached overland (driving to the airport and checking in takes longer than the trip itself).
 */
const MIN_FLIGHT_DISTANCE_WITH_OVERLAND_KM = 350;

interface OriginLeg {
  origin: string;
  airportDetails?: DynamicAirport;
  airportState: string;
  isArbitrage: boolean;
  originDistKm?: number;
  originDriveMins?: number;
  originName: string;
  originCity: string;
  originCountry: string;
  originHighSpeedRail: boolean;
  frictionDriveScore: number;
  /** Set for rail-fed hub legs ("Zug zum Flug"): train from home instead of the car */
  rail?: { durationMinutes: number; distanceKm: number; isAlternativeOrigin: boolean };
}

// Rail-and-fly ("Zug zum Flug") parameters
const RAIL_HUB_MAX_MINUTES = 330;       // Longest acceptable train ride to the departure hub
const RAIL_AIRPORT_TRANSFER_MINUTES = 40; // Local transfer when the airport has no long-distance station
const SHORT_FEEDER_FLIGHT_KM = 500;     // First legs below this are trains, not flights, if rail exists

/** Travel friction of the train ride to the airport (replaces the car-to-airport baseline). */
function railFeederFrictionScore(minutes: number): number {
  if (minutes <= 90) return 94;
  if (minutes <= 180) return 88;
  if (minutes <= 270) return 81;
  return 74;
}

interface PlaneOption {
  leg: OriginLeg;
  flightRoute: FlightRouteDetails;
  directDist: number;
  frictionScore: number;
  replacesFeederFlight?: string;
}

interface OverlandOption {
  vehicle: OverlandVehicle;
  distKm: number;
  access: OverlandAccessResult;
  durationMinutes: number;
  frictionScore: number;
}

interface DestinationContext {
  code: string;
  point: DestinationPoint;
  destinationName: string;
  destinationCity: string;
  destinationCountry: string;
  /** ISO country code of the destination (source-market demand) */
  countryCode?: string;
  destLat: number;
  destLon: number;
  homeDistKm: number;
  availableVehicles: TravelVehicle[];
  /** Every selected overland vehicle that can reach the destination (car, train, bus) */
  overlandOptions: OverlandOption[];
  planeOptions: PlaneOption[];
  styles: DestinationType[];
}

/**
 * Whether the minimum beach temperature (BEACH) or snow guarantee (ALPINE) can matter for a search:
 * explicit destinations, the style itself, "all styles", or a long-range search preferring it.
 */
function climateSettingApplies(input: TripPlanInput, style: 'BEACH' | 'ALPINE'): boolean {
  if ((input.targetDestinations && input.targetDestinations.length > 0) || input.targetRegion) return true;
  const types = input.destinationTypes?.length ? input.destinationTypes : input.destinationType ? [input.destinationType] : ['ALL'];
  if (types.includes('ALL') || types.includes(style) || (style === 'ALPINE' && types.includes('SKI'))) return true;
  if (types.includes('LONGRANGE')) {
    const prefs = input.longRangeStyles || [];
    return prefs.length === 0 || prefs.includes(style);
  }
  return false;
}

export interface OptimizerContextOptions {
  /** School-holiday calendars of Europe's big source markets (demand/crowding model) */
  sourceMarketCalendars?: MarketHolidayCalendar[];
}

/** Destinations further than this from home are barely exposed to European school-holiday demand. */
const LONG_HAUL_DEMAND_KM = 4500;
/** Demand the month-based fare/hotel benchmarks already price in for June-August. */
const SUMMER_BASELINE_DEMAND = 0.55;

/**
 * Relative price change from source-market demand. The benchmark prices already model the
 * summer peak (June-August) and the Christmas surge, so the adjustment only adds what they miss:
 * Easter, Whitsun, autumn and winter breaks of several markets at once - and inside summer it
 * distinguishes early June / late August (fewer markets travelling) from the late July peak.
 */
export function getDemandPriceFactor(demand: SourceMarketDemand | undefined, startDate: string): number {
  if (!demand) return 0;
  const month = parseInt(startDate.slice(5, 7), 10);
  const day = parseInt(startDate.slice(8, 10), 10);
  if ((month === 12 && day >= 19) || (month === 1 && day <= 6)) return 0;
  const baseline = month >= 6 && month <= 8 ? SUMMER_BASELINE_DEMAND : 0;
  const factor = MAX_DEMAND_SURCHARGE * (demand.index - baseline);
  return Math.round(Math.min(MAX_DEMAND_SURCHARGE, Math.max(-0.1, factor)) * 1000) / 1000;
}

/** Applies the demand factor to flight (if flown) and lodging cost of a pricing result. */
function applyDemandAdjustment(pricing: AggregatedTripPricing, factor: number, includeTransport: boolean, travelers: number): AggregatedTripPricing {
  if (!factor) return pricing;
  const flightDelta = includeTransport ? Math.round(pricing.flight.totalFlightCost * factor) : 0;
  const lodgingDelta = Math.round(pricing.lodging.totalLodgingCost * factor);
  const delta = flightDelta + lodgingDelta;
  if (!delta) return pricing;
  const totalCost = pricing.totalCost + delta;
  return {
    ...pricing,
    flight: { ...pricing.flight, totalFlightCost: pricing.flight.totalFlightCost + flightDelta },
    lodging: { ...pricing.lodging, totalLodgingCost: pricing.lodging.totalLodgingCost + lodgingDelta },
    totalCost,
    pricePerPerson: Math.round(totalCost / Math.max(1, travelers)),
    effectiveCost: pricing.effectiveCost !== undefined ? Math.max(0, pricing.effectiveCost + delta) : undefined,
    demandAdjustmentEur: delta,
  };
}

/**
 * Core CSP Vacation Window Optimizer
 */
export function optimizeVacationWindows(
  input: TripPlanInput,
  schoolHolidaysByState: Record<string, SchoolHoliday[]>,
  publicHolidaysByState: Record<string, PublicHoliday[]>,
  weights: OptimizationWeights = DEFAULT_WEIGHTS,
  options: OptimizerContextOptions = {}
): CandidateWindow[] {
  const { userProfile, earliestDate, latestDate } = input;
  const demandTimeline: SourceMarketDemandTimeline | undefined =
    options.sourceMarketCalendars && options.sourceMarketCalendars.length > 0
      ? buildSourceMarketDemandTimeline(options.sourceMarketCalendars, earliestDate, latestDate)
      : undefined;
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
  const homePublicHolidays = homeState ? publicHolidaysByState[homeState] || [] : [];

  // School holidays are evaluated per child: siblings at schools in different regions
  // (or a child at a boarding/cross-border school) each follow their own calendar, and a
  // window only counts as "inside school holidays" when it is inside every child's break.
  const schoolCalendars = resolveChildSchoolCalendars(userProfile, homeState, schoolHolidaysByState, earliestDate);
  const hasSchoolCalendarData = schoolCalendars.some((c) => c.holidays.length > 0);
  // Families without school children: the home region's holidays still drive demand (and prices)
  // at the home airports
  const homeSchoolHolidays = homeState ? schoolHolidaysByState[homeState] || [] : [];

  // Flexible airport search: with no airport selected, every sensible airport around home is
  // evaluated and only the best one per destination and window is kept (see below).
  const isFlexOrigin = !(userProfile.originAirports && userProfile.originAirports.length > 0);
  const flexOrigins =
    isFlexOrigin && userProfile.departureLat != null && userProfile.departureLon != null
      ? resolveFlexOriginAirports(userProfile.departureLat, userProfile.departureLon)
      : [];
  const originAirports =
    userProfile.originAirports && userProfile.originAirports.length > 0
      ? userProfile.originAirports
      : flexOrigins.length > 0
      ? flexOrigins
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
  const planeSelected = selectedVehicles.includes('PLANE');
  const overlandSelected = selectedVehicles.filter((v): v is OverlandVehicle => v !== 'PLANE');

  const originContext: OriginContext = {
    departureLat: userProfile.departureLat,
    departureLon: userProfile.departureLon,
    country: homeState ? getCountryCodeFromSubdivision(homeState) : undefined,
    federalState: homeState,
    originAirports,
    travelVehicle: selectedVehicles[0],
    travelVehicles: selectedVehicles,
    // Only when the style selection makes them relevant (as the search form does), so e.g. a beach
    // temperature cannot reshuffle a city-only long-haul search
    minBeachTemp: climateSettingApplies(input, 'BEACH') ? input.minBeachTemp : undefined,
    requireSnow: climateSettingApplies(input, 'ALPINE') ? input.requireSnow : undefined,
    earliestDate: input.earliestDate,
    latestDate: input.latestDate,
    maxOverlandTravelMinutes: input.maxOverlandTravelMinutes,
    longRangeStyles: input.longRangeStyles,
  };

  // Climate constraints (minimum beach temperature, snow guarantee) also apply to beach /
  // alpine destinations of a long-range search, e.g. "long-haul beach, at least 26 °C".
  const longRangePrefs = input.longRangeStyles || [];
  const longRangeAppliesTo = (style: DestinationType) =>
    selectedTypes.includes('LONGRANGE') && (longRangePrefs.length === 0 || longRangePrefs.includes(style));

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

  const homeCoords = resolveOriginCoordinates(originContext);
  const homeGeo = {
    lat: userProfile.departureLat ?? homeCoords.lat,
    lon: userProfile.departureLon ?? homeCoords.lon,
    countryCode: homeState ? getCountryCodeFromSubdivision(homeState) : undefined,
    state: homeState,
  };
  const maxToleratedStops = input.maxFlightStops ?? userProfile.maxFlightStops;

  // ---------------------------------------------------------------------------------------
  // Date-independent precomputation. Everything below depends only on the origin airport and
  // destination, so it is resolved once instead of once per candidate window.
  // ---------------------------------------------------------------------------------------
  const originLegs: OriginLeg[] = originAirports.map((origin) => {
    const airportDetails = getAirportByIata(origin);
    const airportState = airportDetails?.state || homeState;
    const isArbitrage = airportState !== homeState;

    let originDistKm: number | undefined;
    let originDriveMins: number | undefined;
    if (userProfile.departureLat && userProfile.departureLon && airportDetails) {
      originDistKm = Math.round(
        calculateGeodesicDistanceKm(userProfile.departureLat, userProfile.departureLon, airportDetails.lat, airportDetails.lon)
      );
      originDriveMins = Math.round((originDistKm / 85) * 60);
    }

    return {
      origin,
      airportDetails,
      airportState,
      isArbitrage,
      originDistKm,
      originDriveMins,
      originName: airportDetails?.name
        ? (airportDetails.city ? `${airportDetails.name} (${airportDetails.city})` : airportDetails.name)
        : origin,
      originCity: airportDetails?.city || origin,
      originCountry: airportDetails?.country || '',
      originHighSpeedRail: Boolean(airportDetails?.isHighSpeedRailConnected),
      // Travel friction of getting to the airport: the actual drive. Fares are priced by distance
      // band, so without it a far airport with an equal fare (ZRH from Karlsruhe) won every tie on a
      // slightly shorter flight, while a cross-border airport next door (SXB from Offenburg) was
      // marked down like a distant one. Without home coordinates: flat baseline (lower for
      // out-of-state departures, which are typically further away).
      frictionDriveScore: originDriveMins !== undefined
        ? Math.max(40, Math.round(95 - Math.max(0, originDriveMins - 30) / 5))
        : (isArbitrage ? 80 : 95),
    };
  });

  // "Zug zum Flug": intercontinental hubs the family can reach by train within a few hours,
  // even when they are not among the selected departure airports (e.g. Karlsruhe -> Munich by
  // ICE for a non-stop long-haul flight instead of FKB/STR + a short feeder flight to FRA/MUC).
  const homeCountry = homeState ? getCountryCodeFromSubdivision(homeState) : undefined;
  const railHubLegs: OriginLeg[] = [];
  if (planeSelected && input.railAirSuggestions !== false) {
    for (const hub of PRIMARY_GATEWAY_HUBS) {
      const airport = getAirportByIata(hub);
      if (!airport) continue;
      const geodesic = Math.round(calculateGeodesicDistanceKm(homeGeo.lat, homeGeo.lon, airport.lat, airport.lon));
      if (geodesic < 60 || geodesic > 900) continue;
      const hubGeo = { lat: airport.lat, lon: airport.lon, countryCode: airport.state?.split('-')[0], state: airport.state, code: hub };
      if (!isOverlandReachable(homeGeo, hubGeo)) continue;
      const train = calculateVehicleMetrics('TRAIN', geodesic, 1, true);
      const durationMinutes = train.durationMinutes + (airport.isHighSpeedRailConnected ? 0 : RAIL_AIRPORT_TRANSFER_MINUTES);
      if (durationMinutes > RAIL_HUB_MAX_MINUTES) continue;
      const airportState = airport.state || homeState;
      railHubLegs.push({
        origin: hub,
        airportDetails: airport,
        airportState,
        isArbitrage: airportState !== homeState && airport.state?.split('-')[0] === homeCountry,
        originName: airport.city ? `${airport.name} (${airport.city})` : airport.name,
        originCity: airport.city || hub,
        originCountry: airport.country || '',
        originHighSpeedRail: Boolean(airport.isHighSpeedRailConnected),
        frictionDriveScore: railFeederFrictionScore(durationMinutes),
        rail: {
          durationMinutes,
          distanceKm: train.distanceKm,
          isAlternativeOrigin: !originAirports.map((c) => c.toUpperCase()).includes(hub),
        },
      });
    }
    railHubLegs.sort((a, b) => a.rail!.durationMinutes - b.rail!.durationMinutes);
  }

  const destinationContexts: DestinationContext[] = [];
  for (const dest of candidateDestinations) {
    const point = getDestinationPoint(dest);
    if (!point) continue;

    // Hard safety boundary: full national travel warnings (Auswärtiges Amt Reisewarnung / US
    // Level 4) and active conflict zones are never calculated, even when explicitly requested.
    // Partial warnings (Teilreisewarnungen) stay allowed.
    if (isDestinationBanned(dest, point.country)) continue;

    const destGeo = {
      lat: point.lat,
      lon: point.lon,
      countryCode: point.state ? point.state.split('-')[0] : undefined,
      state: point.state,
      code: dest,
      isHighSpeedRailConnected: point.isHighSpeedRailConnected,
    };
    const highSpeedRail = Boolean(point.isHighSpeedRailConnected);
    const homeDistKm = Math.round(calculateGeodesicDistanceKm(homeGeo.lat, homeGeo.lon, point.lat, point.lon));
    const availableVehicles = getAvailableVehicles(homeGeo, destGeo, homeDistKm);

    // Overland legs: from home, independent of any departure airport. One per selected vehicle in
    // range - a destination can be reached by car *and* train *and* plane, and scoring (not a
    // fixed preference) decides which trip ranks first.
    const overlandOptions: OverlandOption[] = [];
    const overlandVehicles = overlandSelected.filter(
      (v) => availableVehicles.includes(v) && isOverlandVehicleInRange(v, homeDistKm, highSpeedRail)
    );
    if (overlandVehicles.length > 0) {
      const access = classifyOverlandAccess(destGeo);
      if (access.access !== 'FLIGHT_ONLY') {
        for (const vehicle of overlandVehicles) {
          const durationMinutes = calculateVehicleMetrics(vehicle, homeDistKm, 1, highSpeedRail, access, input.carFuelType).durationMinutes;
          if (input.maxOverlandTravelMinutes && durationMinutes > input.maxOverlandTravelMinutes) continue;
          overlandOptions.push({
            vehicle,
            distKm: homeDistKm,
            access,
            durationMinutes,
            frictionScore: calculateOverlandFrictionScore(vehicle, durationMinutes, access.access),
          });
        }
      }
    }

    // Flight legs: one per departure airport (airport destinations only).
    const planeOptions: PlaneOption[] = [];
    if (planeSelected && point.kind === 'AIRPORT') {
      for (const leg of originLegs) {
        const flightRoute = resolveFlightRoute(leg.origin, dest);
        if (maxToleratedStops !== undefined && flightRoute.stops > maxToleratedStops) continue;
        const directDist =
          flightRoute.flightDistanceKm ||
          (leg.airportDetails
            ? Math.round(calculateGeodesicDistanceKm(leg.airportDetails.lat, leg.airportDetails.lon, point.lat, point.lon))
            : 500);
        if (directDist < 180) continue;
        const flightFrictionScore = calculateFlightFrictionScore(
          flightRoute.flightDistanceKm,
          flightRoute.stops,
          flightRoute.totalLayoverMinutes
        );
        planeOptions.push({
          leg,
          flightRoute,
          directDist,
          frictionScore: Math.round(leg.frictionDriveScore * 0.4 + flightFrictionScore * 0.6),
        });
      }

      const isShortFeeder = (o: PlaneOption) =>
        o.flightRoute.stops > 0 && (o.flightRoute.segments[0]?.distanceKm ?? Infinity) < SHORT_FEEDER_FLIGHT_KM;
      const fewestUserStops = planeOptions.reduce((min, o) => Math.min(min, o.flightRoute.stops), Infinity);

      // Rail-and-fly: a train-reachable hub that saves at least one stop compared with the family's
      // own airports (e.g. FKB -> FRA -> FNC becomes train to FRA + non-stop FRA -> FNC).
      if (railHubLegs.length > 0) {
        let best: PlaneOption | undefined;
        let bestKey = [Infinity, Infinity];
        for (const leg of railHubLegs) {
          const flightRoute = resolveFlightRoute(leg.origin, dest);
          // Worth suggesting when it saves a stop, or ties while every equally good routing from
          // the family's own airports starts with a feeder flight the train replaces one-for-one.
          const replacesFeederOnTie =
            flightRoute.stops === fewestUserStops &&
            planeOptions.filter((o) => o.flightRoute.stops === fewestUserStops).every(isShortFeeder);
          if (flightRoute.stops > fewestUserStops || (flightRoute.stops === fewestUserStops && !replacesFeederOnTie)) continue;
          if (maxToleratedStops !== undefined && flightRoute.stops > maxToleratedStops) continue;
          const directDist = flightRoute.flightDistanceKm;
          if (!directDist || directDist < 180) continue;
          const key = [flightRoute.stops, leg.rail!.durationMinutes + flightRoute.totalFlightDurationMinutes];
          if (key[0] > bestKey[0] || (key[0] === bestKey[0] && key[1] >= bestKey[1])) continue;
          const flightFrictionScore = calculateFlightFrictionScore(
            directDist,
            flightRoute.stops,
            flightRoute.totalLayoverMinutes
          );
          bestKey = key;
          best = {
            leg,
            flightRoute,
            directDist,
            frictionScore: Math.round(leg.frictionDriveScore * 0.4 + flightFrictionScore * 0.6),
          };
        }
        if (best) {
          const superseded = planeOptions.find(isShortFeeder);
          if (superseded) {
            const seg = superseded.flightRoute.segments[0];
            best = { ...best, replacesFeederFlight: `${seg.departureAirport}-${seg.arrivalAirport}` };
          }
          planeOptions.push(best);
        }
      }

      // Ultra-short feeder flights (STR -> FRA, FKB -> MUC) are dropped whenever the destination is
      // also reachable without one, with no more stops - by driving to the hub (one of the family's
      // airports), by train (rail-and-fly above) or via a real connection elsewhere.
      const fewestNonFeederStops = planeOptions
        .filter((o) => !isShortFeeder(o))
        .reduce((min, o) => Math.min(min, o.flightRoute.stops), Infinity);
      for (let i = planeOptions.length - 1; i >= 0; i--) {
        if (isShortFeeder(planeOptions[i]) && planeOptions[i].flightRoute.stops >= fewestNonFeederStops) {
          planeOptions.splice(i, 1);
        }
      }

      // Real-network itineraries can chain low-cost legs (FKB -> SKG -> IST -> BKK); keep only options
      // within one extra stop of the best one (e.g. a non-stop from another family airport).
      const fewestStopsOverall = planeOptions.reduce((min, o) => Math.min(min, o.flightRoute.stops), Infinity);
      for (let i = planeOptions.length - 1; i >= 0; i--) {
        if (planeOptions[i].flightRoute.stops > fewestStopsOverall + 1) planeOptions.splice(i, 1);
      }
    }

    // Short hops: no flight when the destination is reachable overland
    if (overlandOptions.length > 0 && homeDistKm < MIN_FLIGHT_DISTANCE_WITH_OVERLAND_KM) planeOptions.length = 0;

    if (overlandOptions.length === 0 && planeOptions.length === 0) continue;

    destinationContexts.push({
      code: dest,
      point,
      destinationName: point.city && point.country ? `${point.city}, ${point.country}` : (point.name || dest),
      destinationCity: point.city || point.name || dest,
      destinationCountry: point.country || '',
      countryCode: destGeo.countryCode,
      destLat: point.lat,
      destLon: point.lon,
      homeDistKm,
      availableVehicles,
      overlandOptions,
      planeOptions,
      styles: getDestinationVacationStyles(dest),
    });
  }

  // Month-level climate memoization: climate and seasonal warnings depend only on the
  // destination and month (and year for moving festivals), not on the individual window.
  const climateCache = new Map<string, WeatherAssessment>();
  const getClimate = (dest: string, monthIndex: number) => {
    const key = `${dest}|${monthIndex}`;
    let weather = climateCache.get(key);
    if (!weather) {
      weather = getEstimatedClimate(dest, monthIndex);
      climateCache.set(key, weather);
    }
    return weather;
  };
  const seasonalCache = new Map<string, SeasonalConstraintWarning | null>();
  const getSeasonal = (dest: string, monthIndex: number, year: number, weather: WeatherAssessment) => {
    const key = `${dest}|${monthIndex}|${year}`;
    if (!seasonalCache.has(key)) {
      seasonalCache.set(key, getDestinationSeasonalWarning(dest, monthIndex, { year, weatherAssessment: weather }));
    }
    return seasonalCache.get(key) ?? null;
  };

  const rawCandidatePool: RawCandidate[] = [];

  const earliest = parseISO(earliestDate);
  const latest = parseISO(latestDate);

  let totalWindowsChecked = 0;
  let blackoutFilteredCount = 0;

  const adultsCount = typeof userProfile.adults === 'number' && userProfile.adults >= 1
    ? userProfile.adults
    : 2;

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
      const travelYear = currentDate.getFullYear();

      // 1. Blackout Filtering (STRICT_BLACKOUT only - CHILDCARE_CLOSURE never filters candidates)
      if (overlapsWithBlackout(startStr, endStr, strictBlackouts)) {
        blackoutFilteredCount++;
        currentDate = addDays(currentDate, 1);
        continue;
      }

      // Dynamic Age Calculation relative to window start date
      let currentChildrenAges = userProfile.childrenAges || [];
      if (Array.isArray(userProfile.childrenBirthDates) && userProfile.childrenBirthDates.length > 0) {
        currentChildrenAges = userProfile.childrenBirthDates.map((bDate) => {
          return Math.max(0, differenceInYears(currentDate, parseISO(bDate)));
        });
      }

      const hasYoungChild = currentChildrenAges.some((age) => age < 6);
      const travelsWithSchoolChildren = currentChildrenAges.some((age) => age >= 6);
      const hasToddler = currentChildrenAges.some((age) => age <= 4);
      const pCostMultiplier = calculatePassengerCostMultiplier(adultsCount, currentChildrenAges, {
        birthDates: userProfile.childrenBirthDates,
        outboundDate: startStr,
        returnDate: endStr,
      });

      // 2. School Holiday Coverage Evaluation (combined across every school child's calendar)
      const holidayCoverage = calculateCombinedHolidayCoverage(startStr, endStr, schoolCalendars);

      // 3. PTO consumption calculation with configurable workweek, factoring in effective
      // marginal PTO consumed when a CHILDCARE_CLOSURE period overlaps this window.
      const ptoInfo = calculateEffectivePtoDaysConsumed(
        startStr,
        endStr,
        homePublicHolidays,
        (userProfile as any).workweekDays,
        childcareClosures
      );
      const ptoEfficiencyRatio = ptoInfo.effectivePtoDaysConsumed > 0
        ? Math.round((durationDays / ptoInfo.effectivePtoDaysConsumed) * 10) / 10
        : durationDays * 2;

      // Arbitrage check per departure airport: the fare advantage exists when the family's own
      // region is on holiday (peak demand at the home airports) while the departure airport's
      // state/country is NOT. Outside the home holidays the home airports are just as cheap, so
      // no discount applies there (it used to, which made FRA/ZRH win nearly every window).
      const homeHolidayOverlap = hasSchoolCalendarData
        ? holidayCoverage.overlapDays
        : calculateHolidayCoverage(startStr, endStr, homeSchoolHolidays).overlapDays;
      const isHomePeak = homeHolidayOverlap >= durationDays / 2;
      const arbitrageByOrigin = new Map<string, { note?: string; state?: string }>();
      for (const leg of isHomePeak ? [...originLegs, ...railHubLegs] : []) {
        if (!leg.isArbitrage) continue;
        const neighborHolidays = schoolHolidaysByState[leg.airportState] || [];
        // Without a calendar for that region we cannot tell whether schools are in session there;
        // an empty list must not read as "never on holiday" (a discount on every date).
        if (!neighborHolidays.some((h) => h.startDate.slice(0, 4) === startStr.slice(0, 4) || h.endDate.slice(0, 4) === startStr.slice(0, 4))) continue;
        const neighborCoverage = calculateHolidayCoverage(startStr, endStr, neighborHolidays);
        if (!neighborCoverage.isFullyInside && neighborCoverage.overlapDays < durationDays / 2) {
          arbitrageByOrigin.set(leg.origin, {
            note: `Arbitrage opportunity: Depart from ${leg.origin} (${leg.airportState}) where schools are in session! Flight fares typically 25-45% lower.`,
            state: leg.airportState,
          });
        }
      }

      // Source-market demand depends on the destination country and distance only
      const demandCache = new Map<string, SourceMarketDemand>();
      const getDemand = (ctx: DestinationContext): SourceMarketDemand | undefined => {
        if (!demandTimeline) return undefined;
        const longHaul = ctx.homeDistKm > LONG_HAUL_DEMAND_KM;
        const key = `${ctx.countryCode || ctx.destinationCountry}|${longHaul}`;
        let demand = demandCache.get(key);
        if (!demand) {
          demand = demandTimeline.demandFor(startStr, endStr, ctx.countryCode, longHaul);
          demandCache.set(key, demand);
        }
        return demand;
      };
      const travelers = adultsCount + currentChildrenAges.length;

      for (const ctx of destinationContexts) {
        const dest = ctx.code;
        const sourceMarketDemand = getDemand(ctx);
        const demandFactor = getDemandPriceFactor(sourceMarketDemand, startStr);

        // Dynamic weather assessment
        const weather = getClimate(dest, monthIndex);
        const baseSeasonalWarning = getSeasonal(dest, monthIndex, travelYear, weather);
        const isHighSourceMarketDemand = Boolean(
          sourceMarketDemand &&
            sourceMarketDemand.index >= HIGH_DEMAND_THRESHOLD &&
            sourceMarketDemand.marketsOnHoliday.length > 0
        );
        const seasonalWarning = isHighSourceMarketDemand
          ? baseSeasonalWarning
            ? {
                ...baseSeasonalWarning,
                marketsOnHoliday: sourceMarketDemand!.marketsOnHoliday,
              }
            : {
                destinationCode: dest,
                seasonType: 'OVERCROWDED_PEAK' as const,
                monthRange: [monthIndex],
                messageKey: 'seasonWarningCrowdedPeak',
                fallbackMessage: `School holidays in ${sourceMarketDemand!.marketsOnHoliday.join(', ')}: High travel demand, crowded destinations, and elevated rates.`,
                eventKey: 'school_holidays',
                marketsOnHoliday: sourceMarketDemand!.marketsOnHoliday,
              }
          : baseSeasonalWarning;

        // Minimum beach temperature constraint
        if (input.minBeachTemp && input.minBeachTemp > 0) {
          const isBeachCandidate = selectedTypes.includes('BEACH') ||
            ((hasUserSelectedDestinations || longRangeAppliesTo('BEACH')) && ctx.styles.includes('BEACH'));
          if (isBeachCandidate) {
            const dayTemp = weather.maxTempC ?? weather.avgTempC;
            if (dayTemp < input.minBeachTemp) {
              continue; // Destination window too cold for user's minimum beach temperature
            }
          }
        }

        // Climate preference constraint: avoid extreme heat (>38°C)
        if (input.avoidExtremeHeat && seasonalWarning?.seasonType === 'EXTREME_HEAT') {
          continue; // Filtered out by user's extreme heat avoidance constraint
        }

        // Winter sports & snow guarantee constraint
        if (input.requireSnow) {
          const isAlpineCandidate = selectedTypes.includes('ALPINE') ||
            ((hasUserSelectedDestinations || longRangeAppliesTo('ALPINE')) && ctx.styles.includes('ALPINE'));
          if (isAlpineCandidate) {
            const altMeters = (ctx.point.altitude || 0) * 0.3048;
            const isWinterSeason = ctx.destLat >= 0
              ? (monthIndex === 11 || monthIndex <= 3)
              : (monthIndex >= 5 && monthIndex <= 9);
            const hasFreezingTemps = weather.avgTempC <= 3 || (weather.minTempC != null && weather.minTempC <= 0);
            const hasSnowConditions = isWinterSeason && hasFreezingTemps && (altMeters >= 450 || (ctx.point.keywords && /ski|snow|alps|dolomites|tirol/i.test(ctx.point.keywords)));
            if (!hasSnowConditions) {
              continue; // No snow / winter sports conditions during this window
            }
          }
        }

        // Biological toddler friction: young children (<=4y) + a significant timezone shift
        // on a short trip (< 10 days) compound travel fatigue disproportionately.
        const utcShiftHours = Math.abs(estimateUtcOffsetHours(ctx.destLon) - estimateUtcOffsetHours(homeGeo.lon));
        const jetlagPenalty = hasToddler && utcShiftHours >= 3 && durationDays < 10
          ? Math.round(utcShiftHours * 2.5 * (10 / durationDays) * 10) / 10
          : 0;

        const baseFields = {
          startDate: startStr,
          endDate: endStr,
          durationDays,
          destinationAirport: dest,
          destinationName: ctx.destinationName,
          destinationCity: ctx.destinationCity,
          destinationCountry: ctx.destinationCountry,
          totalWeekdays: ptoInfo.totalWeekdays,
          publicHolidaysCount: ptoInfo.publicHolidaysCount,
          ptoDaysConsumed: ptoInfo.effectivePtoDaysConsumed,
          rawPtoDaysConsumed: ptoInfo.ptoDaysConsumed,
          overlapsChildcareClosure: ptoInfo.overlappingClosureWeekdays > 0,
          hasYoungChildAtDeparture: hasYoungChild,
          ptoEfficiencyRatio,
          suggestedShifts: ptoInfo.suggestedShifts,
          weather,
          seasonalWarning,
          requiresSchoolExemption: false,
          schoolHolidayDaysOverlap: holidayCoverage.overlapDays,
          travelsWithSchoolChildren,
          holidayCoverage,
          availableVehicles: ctx.availableVehicles,
          jetlagPenalty: jetlagPenalty > 0 ? jetlagPenalty : undefined,
          sourceMarketDemand,
        };

        // ----- Overland candidates (one per vehicle and window, from home) -----
        for (const ov of ctx.overlandOptions) {

          // Long-range & exotic category exclusion when not selected by user
          if (
            !hasUserSelectedDestinations &&
            !selectedTypes.includes('ALL') &&
            !selectedTypes.includes('LONGRANGE') &&
            (ov.distKm >= 3500 || getDestinationVacationStyles(dest, ov.distKm).includes('LONGRANGE'))
          ) {
            continue;
          }

          const vehicleDetails = calculateVehicleMetrics(
            ov.vehicle,
            ov.distKm,
            pCostMultiplier,
            ctx.point.isHighSpeedRailConnected,
            ov.access,
            input.carFuelType
          );

          const basePricing = getSynchronousTripPricing({
            originAirport: OVERLAND_ORIGIN_CODE,
            destinationAirport: dest,
            startDate: startStr,
            endDate: endStr,
            durationDays,
            party: {
              adults: adultsCount,
              childrenAges: currentChildrenAges,
              cabinClass: (userProfile.preferredCabinClass as any) || 'ECONOMY',
            },
            preferredBoardType: input.preferredBoardType,
          });
          const pricingDetails = applyDemandAdjustment(
            toOverlandPricing(basePricing, ov.vehicle, vehicleDetails.estimatedTravelCost, pCostMultiplier, travelers),
            demandFactor,
            false,
            travelers
          );
          const totalCost = pricingDetails.totalCost;

          // Budget check
          if (input.maxBudgetTotal && totalCost > input.maxBudgetTotal) {
            continue;
          }

          rawCandidatePool.push({
            ...baseFields,
            originAirport: OVERLAND_ORIGIN_CODE,
            originName: userProfile.homeLocation || undefined,
            originCity: userProfile.homeLocation || undefined,
            originCountry: homeGeo.countryCode,
            estimatedTotalCost: totalCost,
            pricePerPerson: pricingDetails.pricePerPerson,
            isCachedBenchmark: pricingDetails.isCachedBenchmark,
            pricingDetails,
            boardType: pricingDetails.boardType,
            mealPlanValue: pricingDetails.mealPlanValue,
            effectiveCost: pricingDetails.effectiveCost,
            isArbitrageOpportunity: false,
            layoverPenalty: 0,
            frictionBaseScore: Math.max(5, ov.frictionScore - jetlagPenalty),
            travelVehicle: ov.vehicle,
            vehicleDetails,
            overlandAccess: ov.access.access,
            ferrySurchargeEur: ov.access.ferrySurchargeEur,
            ferryTransitMinutes: ov.access.ferryTransitMinutes,
          });
        }

        // ----- Flight candidates (one per departure airport) -----
        for (const plane of ctx.planeOptions) {
          const { leg, flightRoute, directDist } = plane;

          // Long-range & exotic category exclusion when not selected by user
          if (
            !hasUserSelectedDestinations &&
            !selectedTypes.includes('ALL') &&
            !selectedTypes.includes('LONGRANGE') &&
            (directDist >= 3500 || getDestinationVacationStyles(dest, directDist).includes('LONGRANGE'))
          ) {
            continue;
          }

          const arbitrage = arbitrageByOrigin.get(leg.origin);
          const vehicleDetails = calculateVehicleMetrics('PLANE', directDist, pCostMultiplier);

          // Modular Pricing Engine with deep-links, realistic quotes, and board type modeling
          const pricingDetails = applyDemandAdjustment(getSynchronousTripPricing({
            originAirport: leg.origin,
            destinationAirport: dest,
            startDate: startStr,
            endDate: endStr,
            durationDays,
            party: {
              adults: adultsCount,
              childrenAges: currentChildrenAges,
              cabinClass: (userProfile.preferredCabinClass as any) || 'ECONOMY',
            },
            isArbitrage: Boolean(arbitrage?.note),
            preferredBoardType: input.preferredBoardType,
          }), demandFactor, true, travelers);

          // Rail-and-fly: the round-trip train ride to the hub is part of the trip cost
          const railCost = leg.rail
            ? calculateVehicleMetrics('TRAIN', leg.rail.distanceKm / 1.15, pCostMultiplier, true).estimatedTravelCost
            : 0;
          const totalCost = pricingDetails.totalCost + railCost;
          const effectiveCost =
            (pricingDetails.effectiveCost ??
              Math.max(0, pricingDetails.totalCost - Math.round((pricingDetails.mealPlanValue || 0) * 0.75))) + railCost;

          // Budget check
          if (input.maxBudgetTotal && totalCost > input.maxBudgetTotal) {
            continue;
          }

          rawCandidatePool.push({
            ...baseFields,
            originAirport: leg.origin,
            originName: leg.originName,
            originCity: leg.originCity,
            originCountry: leg.originCountry,
            flightDistanceKm: flightRoute.flightDistanceKm,
            flightDurationMinutes: flightRoute.totalFlightDurationMinutes,
            originDistanceKm: leg.rail ? undefined : leg.originDistKm,
            originDriveMinutes: leg.rail ? undefined : leg.originDriveMins,
            railFeeder: leg.rail
              ? {
                  hubAirport: leg.origin,
                  durationMinutes: leg.rail.durationMinutes,
                  distanceKm: leg.rail.distanceKm,
                  costEur: railCost,
                  isAlternativeOrigin: leg.rail.isAlternativeOrigin,
                  replacesFeederFlight: plane.replacesFeederFlight,
                }
              : undefined,
            originHighSpeedRail: leg.originHighSpeedRail,
            isDirectFlight: flightRoute.isDirect,
            flightStops: flightRoute.stops,
            flightLayovers: flightRoute.layovers,
            flightSegments: flightRoute.segments,
            directFlightPremium: flightRoute.isDirect ? flightRoute.directFlightPremiumMultiplier : undefined,
            layoverPenalty: flightRoute.layoverScorePenalty,
            estimatedTotalCost: totalCost,
            pricePerPerson: railCost
              ? Math.round(totalCost / Math.max(1, adultsCount + currentChildrenAges.length))
              : pricingDetails.pricePerPerson,
            isCachedBenchmark: pricingDetails.isCachedBenchmark,
            pricingDetails: railCost
              ? {
                  ...pricingDetails,
                  travelMode: 'PLANE',
                  totalCost,
                  effectiveCost,
                  pricePerPerson: Math.round(totalCost / Math.max(1, adultsCount + currentChildrenAges.length)),
                }
              : { ...pricingDetails, travelMode: 'PLANE' },
            boardType: pricingDetails.boardType,
            mealPlanValue: pricingDetails.mealPlanValue,
            effectiveCost,
            isArbitrageOpportunity: Boolean(arbitrage?.note),
            arbitrageOriginState: arbitrage?.state,
            arbitrageNote: arbitrage?.note,
            frictionBaseScore: Math.max(5, plane.frictionScore - jetlagPenalty),
            travelVehicle: 'PLANE',
            vehicleDetails,
            parkSleepFlyRecommended: !leg.rail && (leg.originDriveMins || 0) > 90,
            autoSelectedOrigin: isFlexOrigin && flexOrigins.length > 0 ? true : undefined,
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

  const hasAnySchoolKids = (userProfile.childrenAges || []).some((a) => a >= 6) ||
    schoolCalendars.some((c) => c.childIndexes.length > 0);
  const hasSchoolHolidayData = schoolCalendars.some((c) => c.holidays.length > 0);

  if (hasAnySchoolKids && hasSchoolHolidayData) {
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
  let minCost = Infinity;
  let maxCost = -Infinity;
  let minPto = Infinity;
  let maxPto = -Infinity;
  for (const c of eligibleCandidates) {
    const cost = c.effectiveCost ?? c.estimatedTotalCost;
    if (cost < minCost) minCost = cost;
    if (cost > maxCost) maxCost = cost;
    if (c.ptoDaysConsumed < minPto) minPto = c.ptoDaysConsumed;
    if (c.ptoDaysConsumed > maxPto) maxPto = c.ptoDaysConsumed;
  }

  const valueForMoneyStats = buildShorterDurationStats(eligibleCandidates);
  const safetyByDestination = new Map<string, ReturnType<typeof getDestinationSafetyAssessment>>();

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
    // Where measured, how long it rains on a rainy day scales the rain penalty: a short afternoon
    // storm costs far less vacation time than a day of steady rain. ~3 h of noticeable rain is
    // typical on a rainy day, hence the neutral point (1 h -> 0.6x, 5+ h -> 1.4x).
    const rainHours = cand.weather.rainHoursPerRainyDay;
    const rainDurationFactor = rainHours !== undefined ? Math.min(1.4, Math.max(0.6, rainHours / 3)) : 1;
    const rainQuality = Math.max(10, 100 - cand.weather.precipitationRiskPercent * 2 * rainDurationFactor);
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
    // With source-market calendars the peak follows when Europe's big markets actually travel
    // (e.g. late July is peak, mid-June is not; Easter/autumn breaks of several markets are).
    const isGlobalHighPeak = cand.sourceMarketDemand
      ? isPeakChristmas || cand.sourceMarketDemand.index >= HIGH_DEMAND_THRESHOLD
      : isPeakSummer || isPeakChristmas;

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
    const shorter = valueForMoneyStats.get(cand.destinationAirport)?.get(cand.durationDays);
    if (shorter && shorter.count > 0) {
      if (shorter.maxCost >= candTotalCost) {
        valueForMoneyBonus = 8;
      } else {
        const candDaily = candTotalCost / cand.durationDays;
        const avgShorterDaily = shorter.dailyCostSum / shorter.count;
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

    let safetyAssessment = safetyByDestination.get(cand.destinationAirport);
    if (!safetyAssessment) {
      safetyAssessment = getDestinationSafetyAssessment(
        cand.destinationAirport,
        cand.destinationCountry || ''
      );
      safetyByDestination.set(cand.destinationAirport, safetyAssessment);
    }

    return {
      ...cleanCand,
      destinationSafety: safetyAssessment,
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

  // Flexible airport search: the app picks the departure airport, so only the best-scoring
  // option per destination and window survives (e.g. FRA for a non-stop long-haul in July,
  // FKB for a cheap low-cost hop to Mallorca in May).
  const windowsForSelection = isFlexOrigin && flexOrigins.length > 0
    ? keepBestOriginPerWindow(scoredWindows)
    : scoredWindows;

  // Keep a representative, diverse subset (every month/duration/origin covered per destination)
  // instead of every +1-day shift, then interleave distinct destinations for balanced pages.
  const representative = input.maxWindowsPerDestination === 0
    ? windowsForSelection
    : selectRepresentativeWindows(windowsForSelection, {
        maxPerDestination: input.maxWindowsPerDestination ?? DEFAULT_MAX_WINDOWS_PER_DESTINATION,
        maxTotal: input.maxTotalWindows ?? DEFAULT_MAX_TOTAL_WINDOWS,
      });
  return interleaveCandidateWindowsByDestination(representative);
}

/**
 * Best-scoring departure airport per destination, start date, duration and vehicle (ties: lower
 * effective cost). Car/train trips to the same destination are kept as alternatives.
 */
export function keepBestOriginPerWindow(windows: CandidateWindow[]): CandidateWindow[] {
  const best = new Map<string, CandidateWindow>();
  for (const w of windows) {
    const key = `${w.destinationAirport}|${w.startDate}|${w.durationDays}|${w.travelVehicle || 'PLANE'}`;
    const current = best.get(key);
    const cost = (c: CandidateWindow) => c.effectiveCost ?? c.estimatedTotalCost;
    if (!current || w.finalScore > current.finalScore || (w.finalScore === current.finalScore && cost(w) < cost(current))) {
      best.set(key, w);
    }
  }
  return Array.from(best.values());
}

/**
 * Converts a lodging+flight benchmark quote into an overland trip quote: the flight leg is
 * replaced by the vehicle's round-trip cost, flight-only artifacts (layovers, flight deep
 * links, flight+hotel package comparison) are dropped, and the meal-plan-adjusted effective
 * cost is recomputed from the overland total.
 */
function toOverlandPricing(
  base: AggregatedTripPricing,
  vehicle: OverlandVehicle,
  travelCost: number,
  passengerMultiplier: number,
  travelers: number
): AggregatedTripPricing {
  const totalCost = travelCost + base.lodging.totalLodgingCost;
  return {
    ...base,
    travelMode: vehicle,
    flight: {
      ...base.flight,
      originAirport: OVERLAND_ORIGIN_CODE,
      baseAdultFare: Math.round(travelCost / Math.max(1, passengerMultiplier)),
      totalFlightCost: travelCost,
      airlineCarrier: undefined,
      isDirectFlight: undefined,
      stops: undefined,
      layovers: undefined,
      segments: undefined,
      directFlightPremiumMultiplier: undefined,
      connectingSavingsDiscount: undefined,
      dayOfWeekMultiplier: undefined,
      isMidweekSaving: undefined,
    },
    totalCost,
    pricePerPerson: Math.round(totalCost / Math.max(1, travelers)),
    effectiveCost: Math.max(0, totalCost - Math.round((base.mealPlanValue || 0) * 0.75)),
    deepLinks: { ...base.deepLinks, googleFlights: '', skyscanner: '' },
    packageTourDeal: undefined,
  };
}

interface ShorterDurationStats {
  count: number;
  maxCost: number;
  dailyCostSum: number;
}

/**
 * For every destination and duration D, aggregates the candidates of the same destination
 * with a strictly shorter duration (count, max effective cost, sum of daily cost), so the
 * value-for-money bonus is O(n) instead of re-filtering the whole pool per candidate.
 */
function buildShorterDurationStats(
  candidates: RawCandidate[]
): Map<string, Map<number, ShorterDurationStats>> {
  const byDest = new Map<string, Map<number, ShorterDurationStats>>();
  for (const c of candidates) {
    let byDuration = byDest.get(c.destinationAirport);
    if (!byDuration) {
      byDuration = new Map();
      byDest.set(c.destinationAirport, byDuration);
    }
    const cost = c.effectiveCost ?? c.estimatedTotalCost;
    const entry = byDuration.get(c.durationDays) || { count: 0, maxCost: -Infinity, dailyCostSum: 0 };
    entry.count++;
    entry.maxCost = Math.max(entry.maxCost, cost);
    entry.dailyCostSum += cost / c.durationDays;
    byDuration.set(c.durationDays, entry);
  }

  // Convert per-duration buckets into "strictly shorter than D" prefix aggregates.
  const result = new Map<string, Map<number, ShorterDurationStats>>();
  for (const [dest, byDuration] of byDest) {
    const durations = Array.from(byDuration.keys()).sort((a, b) => a - b);
    const prefix = new Map<number, ShorterDurationStats>();
    let running: ShorterDurationStats = { count: 0, maxCost: -Infinity, dailyCostSum: 0 };
    for (const d of durations) {
      prefix.set(d, { ...running });
      const bucket = byDuration.get(d)!;
      running = {
        count: running.count + bucket.count,
        maxCost: Math.max(running.maxCost, bucket.maxCost),
        dailyCostSum: running.dailyCostSum + bucket.dailyCostSum,
      };
    }
    result.set(dest, prefix);
  }
  return result;
}

interface SchoolCalendar {
  region: string;
  holidays: SchoolHoliday[];
  childIndexes: number[];
}

/**
 * Groups the school-age children by the region whose school calendar they follow. Children
 * without an explicit school region follow the home region. Regions without any school
 * holiday data are dropped (honest coverage: unknown calendars must not veto windows).
 */
export function resolveChildSchoolCalendars(
  userProfile: TripPlanInput['userProfile'],
  homeState: string,
  schoolHolidaysByState: Record<string, SchoolHoliday[]>,
  referenceDate?: string
): SchoolCalendar[] {
  const regions = userProfile.childrenSchoolRegions || [];
  const birthDates = userProfile.childrenBirthDates || [];
  const childCount = Math.max(
    userProfile.childrenAges?.length || 0,
    birthDates.length,
    regions.length
  );
  const reference = referenceDate ? parseISO(referenceDate) : new Date();

  // Regions are index-aligned with the birth dates (childrenAges may be sorted by the client),
  // so derive each child's age from its own birth date whenever one is available.
  const ageOf = (i: number): number | undefined => {
    if (birthDates[i]) return Math.max(0, differenceInYears(reference, parseISO(birthDates[i])));
    if (birthDates.length === 0) return userProfile.childrenAges?.[i];
    return undefined;
  };

  const byRegion = new Map<string, number[]>();
  for (let i = 0; i < childCount; i++) {
    // Only school-age children follow a school calendar; a toddler's region must not
    // constrain the search.
    const age = ageOf(i);
    if (age === undefined || age < 6) continue;
    const region = (regions[i] || homeState || '').trim().toUpperCase();
    if (!region) continue;
    const list = byRegion.get(region) || [];
    list.push(i);
    byRegion.set(region, list);
  }
  if (byRegion.size === 0 && homeState) {
    byRegion.set(homeState, []);
  }

  const calendars: SchoolCalendar[] = [];
  for (const [region, childIndexes] of byRegion) {
    const holidays = schoolHolidaysByState[region] || [];
    if (holidays.length === 0) continue;
    calendars.push({ region, holidays, childIndexes });
  }
  return calendars;
}

/**
 * School-holiday coverage across several calendars: a window is fully inside only when it
 * is inside every calendar's break, and the overlap/coverage is that of the least-covered
 * calendar (the child who would miss the most school days).
 */
export function calculateCombinedHolidayCoverage(
  startStr: string,
  endStr: string,
  calendars: SchoolCalendar[]
): HolidayCoverageResult {
  if (calendars.length === 0) {
    return { isFullyInside: true, overlapDays: 0, coverageRatio: 1.0 };
  }
  if (calendars.length === 1) {
    return calculateHolidayCoverage(startStr, endStr, calendars[0].holidays);
  }
  let combined: HolidayCoverageResult | undefined;
  for (const cal of calendars) {
    const cov = calculateHolidayCoverage(startStr, endStr, cal.holidays);
    if (!combined) {
      combined = cov;
      continue;
    }
    combined = {
      isFullyInside: combined.isFullyInside && cov.isFullyInside,
      overlapDays: Math.min(combined.overlapDays, cov.overlapDays),
      coverageRatio: Math.min(combined.coverageRatio, cov.coverageRatio),
    };
  }
  return combined!;
}

export const DEFAULT_MAX_WINDOWS_PER_DESTINATION = 40;
export const DEFAULT_MAX_TOTAL_WINDOWS = 1200;

/**
 * Reduces the scored pool to a representative subset per destination. A wide search produces
 * every +1-day shift for every duration and departure airport (tens of thousands of windows,
 * hundreds of MB of JSON) although the UI only ever shows a featured window plus a handful of
 * curated alternatives per destination. Selection priority per destination:
 *  1. the cheapest, the most PTO-efficient and the best fully-inside-school-holiday window
 *     (the anchors curation surfaces),
 *  2. the best window of every (start month, duration) bucket and of every departure airport,
 *  3. the remaining windows by score, skipping near-duplicates (same origin and duration,
 *     start within one day of an already kept window).
 * When the total still exceeds maxTotal, every destination is trimmed to an even share,
 * keeping its highest-priority windows.
 */
export function selectRepresentativeWindows(
  windows: CandidateWindow[],
  options: { maxPerDestination: number; maxTotal: number }
): CandidateWindow[] {
  const byDestination = new Map<string, CandidateWindow[]>();
  for (const w of windows) {
    const list = byDestination.get(w.destinationAirport) || [];
    list.push(w);
    byDestination.set(w.destinationAirport, list);
  }

  const DAY_MS = 24 * 60 * 60 * 1000;
  const prioritized = new Map<string, CandidateWindow[]>();

  for (const [dest, list] of byDestination) {
    const sorted = [...list].sort((a, b) => b.finalScore - a.finalScore);
    const kept: CandidateWindow[] = [];
    const keptSet = new Set<CandidateWindow>();
    const add = (w: CandidateWindow | undefined) => {
      if (!w || keptSet.has(w)) return;
      keptSet.add(w);
      kept.push(w);
    };

    // 1. Curation anchors
    add(sorted.reduce<CandidateWindow | undefined>((best, w) => (!best || w.estimatedTotalCost < best.estimatedTotalCost ? w : best), undefined));
    add(sorted.reduce<CandidateWindow | undefined>((best, w) => (!best || w.ptoEfficiencyRatio > best.ptoEfficiencyRatio ? w : best), undefined));
    add(sorted.find((w) => !w.requiresSchoolExemption));

    // 2. Coverage buckets (sorted is score-desc, so the first hit per bucket is its best)
    const seenBuckets = new Set<string>();
    for (const w of sorted) {
      const bucket = `${w.startDate.slice(0, 7)}|${w.durationDays}`;
      if (!seenBuckets.has(bucket)) {
        seenBuckets.add(bucket);
        add(w);
      }
    }
    // Every way of getting there (car, train, each departure airport) keeps its best window
    const seenOrigins = new Set<string>();
    for (const w of sorted) {
      const route = `${w.originAirport}|${w.travelVehicle || 'PLANE'}`;
      if (!seenOrigins.has(route)) {
        seenOrigins.add(route);
        add(w);
      }
    }

    // 3. Fill by score, skipping +/-1 day shifts of an already kept window
    for (const w of sorted) {
      if (kept.length >= options.maxPerDestination) break;
      if (keptSet.has(w)) continue;
      const start = Date.parse(w.startDate);
      const isShift = kept.some(
        (k) =>
          k.originAirport === w.originAirport &&
          k.travelVehicle === w.travelVehicle &&
          k.durationDays === w.durationDays &&
          Math.abs(Date.parse(k.startDate) - start) <= DAY_MS
      );
      if (!isShift) add(w);
    }

    prioritized.set(dest, kept.slice(0, Math.max(options.maxPerDestination, 3)));
  }

  let total = 0;
  for (const list of prioritized.values()) total += list.length;

  if (total > options.maxTotal && prioritized.size > 0) {
    const share = Math.max(3, Math.floor(options.maxTotal / prioritized.size));
    for (const [dest, list] of prioritized) {
      prioritized.set(dest, list.slice(0, share));
    }
  }

  const result: CandidateWindow[] = [];
  for (const list of prioritized.values()) result.push(...list);
  return result;
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
