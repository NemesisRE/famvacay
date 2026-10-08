import type { SeasonalConstraintWarning } from './weather';

export type DestinationType = 'BEACH' | 'CITY' | 'NATURE' | 'SKI';

export type ChildAgeTier = 'infant' | 'child' | 'teen'; // <2, 2-11, 12+

export interface ChildPassenger {
  age: number;
  tier: ChildAgeTier;
}

export interface UserProfileInput {
  id?: string;
  homeLocation: string;
  originAirports: string[]; // e.g. ["STR", "FKB", "FRA"]
  federalState: string;     // e.g. "DE-BW"
  childrenAges: number[];    // e.g. [1, 7, 14]
  blackoutRanges: BlackoutRange[];
}

export interface BlackoutRange {
  startDate: string; // ISO date YYYY-MM-DD
  endDate: string;   // ISO date YYYY-MM-DD
  reason?: string;
}

export interface TripPlanInput {
  id?: string;
  destinationType: DestinationType;
  targetRegion?: string;     // Specific airport code (e.g. "PMI") or null/empty for auto-discovery
  durationDays: number;      // Fixed or base window length
  durationDaysMin?: number;  // Flexible minimum duration
  durationDaysMax?: number;  // Flexible maximum duration
  earliestDate: string;      // YYYY-MM-DD
  latestDate: string;        // YYYY-MM-DD
  maxBudgetTotal?: number;
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
}

export interface CandidateWindow {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  durationDays: number;
  originAirport: string;
  destinationAirport: string;
  
  // PTO metrics
  totalWeekdays: number;
  publicHolidaysCount: number;
  ptoDaysConsumed: number;
  ptoEfficiencyRatio: number; // (durationDays / ptoDaysConsumed) normalized
  
  // Pricing metrics
  estimatedTotalCost: number;
  pricePerPerson: number;
  isCachedBenchmark: boolean;
  
  // Weather metrics
  weather: WeatherAssessment;
  seasonalWarning?: SeasonalConstraintWarning | null;
  
  // Arbitrage info
  isArbitrageOpportunity: boolean;
  arbitrageOriginState?: string;
  arbitrageNote?: string;

  // Normalized scores (0 - 100)
  scoreBreakdown: {
    priceIndex: number;
    weatherIndex: number;
    ptoEfficiencyIndex: number;
    travelFrictionIndex: number;
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

