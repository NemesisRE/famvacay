import type { SeasonalConstraintWarning, SeasonalWarningImpact } from './weather';
import type { FlightLayover, FlightSegment } from '../airports/flight-routes';

export type DestinationType = 'ALL' | 'BEACH' | 'ALPINE' | 'CITY' | 'NATURE' | 'LONGRANGE' | 'SKI';

export type TravelVehicle = 'PLANE' | 'CAR' | 'TRAIN' | 'BUS';

export type CarFuelType = 'PETROL' | 'DIESEL' | 'ELECTRIC';

export interface VehicleTravelMetrics {
  vehicle: TravelVehicle;
  durationMinutes: number;
  distanceKm: number;
  estimatedTravelCost: number;
  isOverlandReachable: boolean;
  co2KgEstimate?: number;
  // Car only: drivetrain the cost/CO2/time model was computed for
  fuelType?: CarFuelType;
  energyCostEur?: number;    // Round-trip fuel or charging cost
  chargingStops?: number;    // Extra fast-charging stops per direction (electric only)
}

export type ChildAgeTier = 'infant' | 'child' | 'teen'; // <2, 2-11, 12+

export interface ChildPassenger {
  age: number;
  tier: ChildAgeTier;
}

export interface UserProfileInput {
  id?: string;
  homeLocation: string;
  departureLat?: number;
  departureLon?: number;
  originAirports: string[]; // e.g. ["STR", "FKB", "FRA", "CDG"]
  federalState: string;     // e.g. "DE-BW"
  workweekDays?: number[];  // [1, 2, 3, 4, 5] for Mon-Fri
  adults?: number;          // Number of adult travelers (defaults to 2)
  childrenAges: number[];    // e.g. [1, 7, 14]
  childrenBirthDates?: string[]; // ISO date YYYY-MM-DD
  childrenSchoolRegions?: (string | null)[]; // ISO 3166-2 school region per child (index-aligned); null/omitted = home region
  blackoutRanges: BlackoutRange[];
  preferredCabinClass?: string;
  travelModes?: string[];
  maxFlightStops?: number;  // 0 = direct only, 1 = max 1 stop, undefined = any
}

export type PeriodType = 'STRICT_BLACKOUT' | 'CHILDCARE_CLOSURE';

export interface BlackoutRange {
  startDate: string; // ISO date YYYY-MM-DD
  endDate: string;   // ISO date YYYY-MM-DD
  reason?: string;
  type?: PeriodType; // Defaults to STRICT_BLACKOUT when omitted
  coverageFactor?: number; // 0-1: % of CHILDCARE_CLOSURE days parents must cover with own PTO (default 1.0)
}

/**
 * "Zug zum Flug" (rail & fly): the family takes the train from home to a departure hub instead
 * of a short feeder flight (or because the hub offers a non-stop flight their airports lack).
 */
export interface RailFeederLeg {
  hubAirport: string;
  durationMinutes: number;   // Door-to-terminal, one way (incl. airport transfer when needed)
  distanceKm: number;        // Rail distance, one way
  costEur: number;           // Round trip for the whole party
  isAlternativeOrigin: boolean; // Hub was not among the user's selected departure airports
  replacesFeederFlight?: string; // e.g. "STR-FRA" when it supersedes an ultra-short feeder leg
}

export interface ChildcareArbitrageWarning {
  savedPtoDays: number;
  extraCostEur: number;
  costPerSavedPtoDay: number;
  bestOffPeakDateRange: { startDate: string; endDate: string };
  bestOffPeakPrice: number;
}

export type BoardType = 'ALL_INCLUSIVE' | 'HALF_BOARD' | 'BREAKFAST' | 'ROOM_ONLY';

export interface TripPlanInput {
  id?: string;
  destinationType?: DestinationType;
  destinationTypes?: DestinationType[]; // Flexible multiple vacation styles (e.g. ['BEACH', 'ALPINE'])
  longRangeStyles?: DestinationType[];  // Preferred kind of long-haul trip when LONGRANGE is selected (BEACH | CITY | NATURE | ALPINE); empty = any
  targetDestinations?: string[];    // Flexible multiple destination tags (e.g. ['Egypt', 'Mallorca'])
  /** Open discovery only: ISO 3166-1 alpha-2 countries never proposed; their slots go to other destinations */
  excludedCountries?: string[];
  targetRegion?: string;           // Optional single destination code
  durationDays: number;            // Fixed or base window length
  durationDaysMin?: number;        // Flexible minimum duration
  durationDaysMax?: number;        // Flexible maximum duration
  earliestDate: string;            // YYYY-MM-DD
  latestDate: string;              // YYYY-MM-DD
  maxBudgetTotal?: number;
  strictSchoolHolidays?: boolean;   // If true, strictly restricts results to 100% enclosed school holiday windows
  travelVehicle?: TravelVehicle;    // Single travel mode (backward-compat)
  travelVehicles?: TravelVehicle[];  // Multiple selectable travel modes (e.g. ['PLANE', 'CAR', 'TRAIN'])
  minBeachTemp?: number;             // Minimum daytime temperature for sun/beach vacations (e.g. 20, 22, 25°C)
  requireSnow?: boolean;             // If true, strictly requires snow / winter sports conditions for alpine vacations
  preferredBoardType?: BoardType;    // Board type preference (e.g. 'ALL_INCLUSIVE', 'BREAKFAST')
  maxOverlandTravelMinutes?: number; // Maximum overland travel duration in minutes (e.g. 360 for 6h)
  carFuelType?: CarFuelType;         // Drivetrain of the family car (fuel/charging cost, CO2, charging stops)
  maxFlightStops?: number;           // Maximum tolerated flight stops (0 = direct only, 1 = max 1 stop, undefined = any)
  railAirSuggestions?: boolean;      // "Zug zum Flug": suggest rail-connected hubs for non-stop flights (default true)
  avoidExtremeHeat?: boolean;        // Optional climate preference constraint to filter/penalize extreme summer heat (>38°C)
  userProfile: UserProfileInput;
  searchBlackouts?: BlackoutRange[]; // Additional search-specific blackouts
  maxWindowsPerDestination?: number; // Representative windows kept per destination (default 40, 0 = keep all)
  maxTotalWindows?: number;          // Global cap on returned windows (default 1200)
  /** Open discovery only: 'extended' also searches the second tier of destinations (the
   *  background phase of a progressive search). Default 'primary'. */
  discoveryScope?: 'primary' | 'extended';
}

export interface PublicHoliday {
  date: string; // YYYY-MM-DD
  name: string;
  state?: string;
}

export interface SchoolHoliday {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  name: string;
  state: string;
}

export interface WeatherAssessment {
  avgTempC: number;
  precipitationRiskPercent: number;
  isSuitable: boolean;
  reason?: string;
  maxTempC?: number;
  minTempC?: number;
  waterTempC?: number | null;
  rainyDays?: number;
  /** Mean hours of rain on a rainy day (measured; absent where no rain-duration data exists). */
  rainHoursPerRainyDay?: number;
  /** Mean precipitation in mm/day (measured climate normals; absent for formula estimates). */
  precipitationMmPerDay?: number;
  sunshineHoursPerDay?: number;
  hasSnow?: boolean;
  snowDepthCm?: number;
}

export interface CandidateWindow {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  durationDays: number;
  originAirport: string;
  destinationAirport: string;

  // Destination & Flight Logistics
  destinationName?: string;
  destinationCity?: string;
  destinationCountry?: string;
  originName?: string;
  originCity?: string;
  originCountry?: string;
  flightDistanceKm?: number;
  flightDurationMinutes?: number;
  originDistanceKm?: number;
  originDriveMinutes?: number;
  originHighSpeedRail?: boolean;

  // Flight Route & Layover Logistics
  isDirectFlight?: boolean;
  flightStops?: number;
  flightLayovers?: FlightLayover[];
  flightSegments?: FlightSegment[];
  directFlightPremium?: number;
  layoverPenalty?: number;
  
  // PTO metrics
  totalWeekdays: number;
  publicHolidaysCount: number;
  ptoDaysConsumed: number;
  ptoEfficiencyRatio: number; // (durationDays / ptoDaysConsumed) normalized
  suggestedShifts?: import('./pto-calculator').AdjacentShiftSuggestion[];
  
  // Pricing metrics
  estimatedTotalCost: number;
  pricePerPerson: number;
  isCachedBenchmark: boolean;
  pricingDetails?: import('../pricing/types').AggregatedTripPricing;
  
  // Weather metrics
  weather: WeatherAssessment;
  seasonalWarning?: SeasonalConstraintWarning | null;
  seasonalWarningImpact?: SeasonalWarningImpact | null;
  seasonalWarningPenalty?: number;
  
  // Arbitrage info
  isArbitrageOpportunity: boolean;
  arbitrageOriginState?: string;
  arbitrageNote?: string;

  // Childcare closure opportunity cost (daycare/Kita closure vs. peak-season price gouging)
  overlapsChildcareClosure?: boolean;
  hasYoungChildAtDeparture?: boolean; // true if any traveling child is < 6y old at window start
  rawPtoDaysConsumed?: number; // PTO consumed ignoring childcare closure coverage
  childcareArbitrageWarning?: ChildcareArbitrageWarning;

  // School holiday match details
  requiresSchoolExemption?: boolean;
  schoolHolidayDaysOverlap?: number;
  /** A school-age child (6+ at departure) travels, so the window is bound to school holidays */
  travelsWithSchoolChildren?: boolean;

  // Travel vehicle metrics & multi-modal availability
  travelVehicle?: TravelVehicle;
  availableVehicles?: TravelVehicle[];
  vehicleDetails?: VehicleTravelMetrics;
  overlandAccess?: import('./vehicles').OverlandAccessClass;
  ferrySurchargeEur?: number;
  ferryTransitMinutes?: number;
  jetlagPenalty?: number;
  parkSleepFlyRecommended?: boolean;
  railFeeder?: RailFeederLeg;
  /** Demand from Europe's big source markets' school holidays during the window (crowding & prices) */
  sourceMarketDemand?: import('../holidays/source-markets').SourceMarketDemand;
  /** Departure airport picked automatically (flexible airport search: no airport selected) */
  autoSelectedOrigin?: boolean;

  // Travel Safety & Security Assessment (baseline destination-level attribute)
  destinationSafety?: import('../safety/safety-service').DestinationSafetyAssessment;
  safetyAssessment?: import('../safety/safety-service').DestinationSafetyAssessment;

  // Board Type & Fair Meal Plan Value Calculation
  boardType?: BoardType;
  mealPlanValue?: number;
  effectiveCost?: number;

  // Off-Peak and Value-for-Money bonuses
  isOffPeak?: boolean;
  offPeakBonus?: number;
  valueForMoneyBonus?: number;

  // Normalized scores (0 - 100)
  scoreBreakdown: {
    priceIndex: number;
    weatherIndex: number;
    ptoEfficiencyIndex: number;
    travelFrictionIndex: number;
    offPeakBonus?: number;
    valueForMoneyBonus?: number;
  };
  finalScore: number;
}

export interface OptimizationWeights {
  w1_price: number;
  w2_weather: number;
  w3_pto: number;
  w4_friction: number;
}

export const DEFAULT_WEIGHTS: OptimizationWeights = {
  w1_price: 0.35,
  w2_weather: 0.25,
  w3_pto: 0.30,
  w4_friction: 0.10,
};

