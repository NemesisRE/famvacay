import type { FlightLayover, FlightSegment } from '../airports/flight-routes';

export type { FlightLayover, FlightSegment };

export interface PricingPartyComposition {
  adults: number;
  childrenAges: number[];
  cabinClass?: 'ECONOMY' | 'PREMIUM_ECONOMY' | 'BUSINESS';
}

export interface PricingFlightQuote {
  originAirport: string;
  destinationAirport: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  baseAdultFare: number;
  totalFlightCost: number;
  airlineCarrier?: string;
  isDirectFlight?: boolean;
  stops?: number; // 0 for direct, 1 for 1 stop, 2 for 2 stops
  layovers?: FlightLayover[];
  segments?: FlightSegment[];
  directFlightPremiumMultiplier?: number;
  connectingSavingsDiscount?: number;
  dayOfWeekMultiplier?: number;
  isMidweekSaving?: boolean;
  holidaySurgeMultiplier?: number;
}

export interface PricingLodgingQuote {
  destinationCode: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  nights: number;
  nightlyRate: number;
  totalLodgingCost: number;
  propertyType?: string; // e.g. 'Family Resort', 'Apartment', 'Boutique Hotel'
  boardType?: import('../optimizer/types').BoardType;
  mealPlanValue?: number;
  /** Value of the included meals per adult/child and night at the destination's price level */
  mealPlanRates?: import('./meal-plan-value').MealPlanRates;
}

export interface DeepLinkUrls {
  googleFlights: string;
  skyscanner: string;
  bookingCom: string;
}

export interface AggregatedTripPricing {
  flight: PricingFlightQuote;
  lodging: PricingLodgingQuote;
  totalCost: number;
  pricePerPerson: number;
  boardType?: import('../optimizer/types').BoardType;
  mealPlanValue?: number;
  mealPlanRates?: import('./meal-plan-value').MealPlanRates;
  effectiveCost?: number;
  providerSource: string; // 'PortalAggregator' | 'AmadeusLive' | 'BenchmarkEstimator'
  isCachedBenchmark: boolean;
  deepLinks: DeepLinkUrls;
  party?: PricingPartyComposition;
  packageTourDeal?: import('./pricing-service').PackageTourComparison;
  travelMode?: import('../optimizer/types').TravelVehicle; // How the "flight" leg is actually travelled (PLANE, or CAR/TRAIN/BUS for overland trips)
  /** Price change (EUR, can be negative) from European source-market school holidays, already included in the totals */
  demandAdjustmentEur?: number;
}

export interface TravelPricingProvider {
  readonly name: string;
  getTripPricing(params: {
    originAirport: string;
    destinationAirport: string;
    startDate: string;
    endDate: string;
    durationDays: number;
    party: PricingPartyComposition;
    isArbitrage?: boolean;
    preferredBoardType?: import('../optimizer/types').BoardType;
  }): Promise<AggregatedTripPricing>;
}

