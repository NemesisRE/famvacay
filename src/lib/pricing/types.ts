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
  providerSource: string; // 'PortalAggregator' | 'AmadeusLive' | 'BenchmarkEstimator'
  isCachedBenchmark: boolean;
  deepLinks: DeepLinkUrls;
  party?: PricingPartyComposition;
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
  }): Promise<AggregatedTripPricing>;
}

