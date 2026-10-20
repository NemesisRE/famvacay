import type { SeasonalConstraintWarning, SeasonalWarningImpact } from './weather';
import type { FlightLayover, FlightSegment } from '../airports/flight-routes';

export type DestinationType = 'ALL' | 'BEACH' | 'ALPINE' | 'CITY' | 'NATURE' | 'LONGRANGE' | 'SKI';

export type TravelVehicle = 'PLANE' | 'CAR' | 'TRAIN' | 'BUS';

export interface VehicleTravelMetrics {
  vehicle: TravelVehicle;
  durationMinutes: number;
  distanceKm: number;
  estimatedTravelCost: number;
  isOverlandReachable: boolean;
  co2KgEstimate?: number;
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
  blackoutRanges: BlackoutRange[];
  maxDrivingHours?: number;
  preferredCabinClass?: string;
  climatePreference?: string;
  travelModes?: string[];
  maxFlightStops?: number;  // 0 = direct only, 1 = max 1 stop, undefined = any
}

export interface BlackoutRange {
  startDate: string; // ISO date YYYY-MM-DD
  endDate: string;   // ISO date YYYY-MM-DD
  reason?: string;
}

export type BoardType = 'ALL_INCLUSIVE' | 'HALF_BOARD' | 'BREAKFAST' | 'ROOM_ONLY';

export interface TripPlanInput {
  id?: string;
  destinationType?: DestinationType;
  destinationTypes?: DestinationType[]; // Flexible multiple vacation styles (e.g. ['BEACH', 'ALPINE'])
  targetDestinations?: string[];    // Flexible multiple destination tags (e.g. ['Egypt', 'Mallorca'])
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
  maxFlightStops?: number;           // Maximum tolerated flight stops (0 = direct only, 1 = max 1 stop, undefined = any)
  avoidExtremeHeat?: boolean;        // Optional climate preference constraint to filter/penalize extreme summer heat (>38°C)
  userProfile: UserProfileInput;
  searchBlackouts?: BlackoutRange[]; // Additional search-specific blackouts
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

  // School holiday match details
  requiresSchoolExemption?: boolean;
  schoolHolidayDaysOverlap?: number;

  // Travel vehicle metrics & multi-modal availability
  travelVehicle?: TravelVehicle;
  availableVehicles?: TravelVehicle[];
  vehicleDetails?: VehicleTravelMetrics;

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

