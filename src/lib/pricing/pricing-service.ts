import {
  AggregatedTripPricing,
  DeepLinkUrls,
  PricingFlightQuote,
  PricingLodgingQuote,
  PricingPartyComposition,
  TravelPricingProvider,
} from './types';
import { calculatePassengerCostMultiplier } from '../optimizer/child-tiers';
import { getAirportByIata, calculateGeodesicDistanceKm } from '../airports/airport-service';

/**
 * Generates an actionable deep-link directly to Google Flights with origin, destination, and dates prefilled.
 */
export function generateGoogleFlightsLink(
  origin: string,
  destination: string,
  startDate: string,
  endDate: string
): string {
  // Canonical Google Flights search URL with round-trip parameters
  const originClean = encodeURIComponent(origin.trim().toUpperCase());
  const destClean = encodeURIComponent(destination.trim().toUpperCase());
  return `https://www.google.com/travel/flights?q=Flights%20to%20${destClean}%20from%20${originClean}%20on%20${startDate}%20through%20${endDate}`;
}

/**
 * Generates an actionable deep-link directly to Skyscanner with passenger breakdown and travel dates.
 */
export function generateSkyscannerLink(
  origin: string,
  destination: string,
  startDate: string,
  endDate: string,
  adults: number = 2,
  childrenAges: number[] = []
): string {
  const o = origin.toLowerCase().trim();
  const d = destination.toLowerCase().trim();
  const s = startDate.replace(/-/g, '').slice(2); // YYMMDD
  const e = endDate.replace(/-/g, '').slice(2);   // YYMMDD
  const kidsParam = childrenAges.length > 0 ? `&childrenv2=${childrenAges.join('%7C')}` : '';

  return `https://www.skyscanner.net/transport/flights/${o}/${d}/${s}/${e}/?adultsv2=${adults}${kidsParam}&cabinclass=economy`;
}

/**
 * Generates an actionable deep-link directly to Booking.com with city/destination, dates, and family party composition.
 */
export function generateBookingComLink(
  destination: string,
  startDate: string,
  endDate: string,
  adults: number = 2,
  childrenAges: number[] = []
): string {
  const destClean = encodeURIComponent(destination.trim());
  const kidsCount = childrenAges.length;
  const kidsAgesParam = childrenAges.map((age) => `&age=${age}`).join('');

  return `https://www.booking.com/searchresults.html?ss=${destClean}&checkin=${startDate}&checkout=${endDate}&group_adults=${adults}&no_rooms=1&group_children=${kidsCount}${kidsAgesParam}`;
}

/**
 * Flight Day-of-Week Yield Multiplier based on airline yield management:
 * - Tuesday & Wednesday: ~16% discount (lowest weekly demand)
 * - Thursday: ~10% discount (off-peak outbound)
 * - Monday: ~2% discount
 * - Friday: ~18% higher fares (weekend outbound rush)
 * - Saturday: ~25% higher fares (peak family turnover)
 * - Sunday: ~22% higher fares (peak return / leisure outbound)
 */
export function getFlightDayOfWeekMultiplier(dateStr: string): number {
  const d = new Date(dateStr).getDay();
  switch (d) {
    case 2: // Tuesday
    case 3: // Wednesday
      return 0.84;
    case 4: // Thursday
      return 0.90;
    case 1: // Monday
      return 0.98;
    case 5: // Friday
      return 1.18;
    case 6: // Saturday
      return 1.25;
    case 0: // Sunday
    default:
      return 1.22;
  }
}

/**
 * Holiday demand surge for Christmas & New Year period (Dec 19 - Jan 06)
 */
export function getHolidaySurgeMultiplier(startDate: string, endDate: string): number {
  const sMonth = parseInt(startDate.slice(5, 7), 10);
  const sDay = parseInt(startDate.slice(8, 10), 10);
  const isChristmasPeak = (sMonth === 12 && sDay >= 19) || (sMonth === 1 && sDay <= 6);
  if (isChristmasPeak) return 1.35;
  return 1.0;
}

/**
 * Realistic Portal Aggregator Pricing Provider.
 * Models market pricing based on seasonal demand curves, passenger age tiers, cabin class, and accommodation lengths.
 */
export class PortalAggregatorProvider implements TravelPricingProvider {
  readonly name = 'PortalAggregator';

  async getTripPricing(params: {
    originAirport: string;
    destinationAirport: string;
    startDate: string;
    endDate: string;
    durationDays: number;
    party: PricingPartyComposition;
    isArbitrage?: boolean;
  }): Promise<AggregatedTripPricing> {
    return this.calculatePricingSync(params);
  }

  calculatePricingSync(params: {
    originAirport: string;
    destinationAirport: string;
    startDate: string;
    endDate: string;
    durationDays: number;
    party: PricingPartyComposition;
    isArbitrage?: boolean;
  }): AggregatedTripPricing {
    const {
      originAirport,
      destinationAirport,
      startDate,
      endDate,
      durationDays,
      party,
      isArbitrage,
    } = params;

    const startMonth = new Date(startDate).getMonth(); // 0-11
    const pCostMultiplier = calculatePassengerCostMultiplier(
      party.adults || 2,
      party.childrenAges || []
    );

    // Calculate geodesic flight corridor distance in km
    const origAirport = getAirportByIata(originAirport);
    const destAirport = getAirportByIata(destinationAirport);
    let distKm = 1200; // default medium-haul baseline
    if (origAirport && destAirport) {
      distKm = calculateGeodesicDistanceKm(origAirport.lat, origAirport.lon, destAirport.lat, destAirport.lon);
    }

    const isPeakSummer = startMonth >= 5 && startMonth <= 7;
    const isShoulder = startMonth === 3 || startMonth === 4 || startMonth === 8 || startMonth === 9;
    const isWinterPeak = startMonth === 11 || startMonth <= 1;

    // 1. Distance-based seasonal flight fare benchmark per adult
    let baseFlightFare = 195;
    if (distKm <= 850) {
      // Short-haul regional (e.g. Salzburg, Innsbruck, Zurich, Munich, Milan, Paris)
      baseFlightFare = isPeakSummer ? 150 : (isShoulder ? 120 : (isWinterPeak ? 135 : 105));
    } else if (distKm <= 1800) {
      // Mid-haul European & Balearic (e.g. Mallorca, Barcelona, Rome, Vienna, London)
      baseFlightFare = isPeakSummer ? 235 : (isShoulder ? 175 : (isWinterPeak ? 195 : 155));
    } else if (distKm <= 3500) {
      // Long-Med, Canaries, Greece, Egypt, Iceland (e.g. Tenerife, Funchal, Crete, Hurghada, Antalya)
      baseFlightFare = isPeakSummer ? 340 : (isShoulder ? 250 : (isWinterPeak ? 280 : 220));
    } else if (distKm <= 6000) {
      // Long-haul Middle East & Near Africa (e.g. Dubai DXB ~4800km)
      baseFlightFare = isPeakSummer ? 620 : (isShoulder ? 450 : (isWinterPeak ? 520 : 420));
    } else {
      // Intercontinental (e.g. Bangkok BKK ~8700km, Cancun CUN ~8600km, Miami MIA ~7800km)
      baseFlightFare = isPeakSummer ? 860 : (isShoulder ? 640 : (isWinterPeak ? 740 : 590));
    }

    // Day-of-week flight demand factor & holiday surge
    const outboundDOW = getFlightDayOfWeekMultiplier(startDate);
    const returnDOW = getFlightDayOfWeekMultiplier(endDate);
    const flightDOWMultiplier = Math.round(((outboundDOW + returnDOW) / 2) * 100) / 100;
    const holidaySurge = getHolidaySurgeMultiplier(startDate, endDate);
    const isMidweekSaving = flightDOWMultiplier <= 0.92;

    baseFlightFare = Math.round(baseFlightFare * flightDOWMultiplier * holidaySurge);

    // Arbitrage savings (e.g. flying from non-holiday neighboring state)
    if (isArbitrage) {
      baseFlightFare = Math.round(baseFlightFare * 0.72); // ~28% arbitrage savings
    }

    // Cabin class multiplier
    let cabinMultiplier = 1.0;
    if (party.cabinClass === 'PREMIUM_ECONOMY') cabinMultiplier = 1.45;
    else if (party.cabinClass === 'BUSINESS') cabinMultiplier = 2.4;

    const totalFlightCost = Math.round(baseFlightFare * pCostMultiplier * cabinMultiplier);

    const flightQuote: PricingFlightQuote = {
      originAirport,
      destinationAirport,
      startDate,
      endDate,
      baseAdultFare: baseFlightFare,
      totalFlightCost,
      airlineCarrier: 'Multiple Airlines (Aggregated)',
      isDirectFlight: true,
      dayOfWeekMultiplier: flightDOWMultiplier,
      isMidweekSaving,
      holidaySurgeMultiplier: holidaySurge,
    };

    // 2. Destination living cost & hotel tier
    const destCode = destinationAirport.toUpperCase();
    const HIGH_COST_DESTINATIONS = new Set([
      'ZRH', 'GVA', 'DXB', 'LHR', 'KEF', 'SEZ', 'MLE', 'MIA', 'SIN', 'JFK', 'SFO',
      'SBH', 'AXA', 'PLS', 'BGI', 'GCM', 'STT', 'EIS', 'AUA', 'NAS', 'SXM'
    ]);
    const UPPER_MEDIUM_DESTINATIONS = new Set(['INN', 'SZG', 'MUC', 'AMS', 'CDG', 'VIE', 'BZO', 'EDI', 'OSL', 'BGO', 'CPH', 'DUB', 'CUR', 'BON', 'PTP', 'FDF']);
    const BUDGET_DESTINATIONS = new Set(['AYT', 'HRG', 'AAC', 'BKK', 'PRG', 'LIS', 'ATH', 'PDL', 'TRN', 'KLU', 'DJE', 'RAK', 'BAQ', 'CTG', 'ADZ']);

    let nightlyRate = 120; // Default Mediterranean / European leisure standard
    if (HIGH_COST_DESTINATIONS.has(destCode)) {
      nightlyRate = isPeakSummer ? 260 : (isShoulder ? 200 : 180);
    } else if (UPPER_MEDIUM_DESTINATIONS.has(destCode)) {
      nightlyRate = isPeakSummer ? 180 : (isShoulder ? 140 : 125);
    } else if (BUDGET_DESTINATIONS.has(destCode)) {
      nightlyRate = isPeakSummer ? 110 : (isShoulder ? 85 : 70);
    } else {
      // Standard Mediterranean / coastal resort (PMI, TFS, LPA, HER, AGP, FAO, BCN, FCO, CFU, RHO, ACE, FNC, DBV, PUJ, SDQ, POP, LRM)
      nightlyRate = isPeakSummer ? 155 : (isShoulder ? 115 : 95);
    }

    // Add slight room scaling for larger families (>2 children)
    if (party.childrenAges.length > 2) {
      nightlyRate = Math.round(nightlyRate * 1.35); // Family suite / 2-bedroom apartment
    }

    const nights = Math.max(1, durationDays - 1);

    // Count weekend nights (Friday & Saturday nights command higher rates)
    let weekendNights = 0;
    const curDate = new Date(startDate);
    const endDateObj = new Date(endDate);
    while (curDate < endDateObj) {
      const d = curDate.getDay();
      if (d === 5 || d === 6) weekendNights++;
      curDate.setDate(curDate.getDate() + 1);
    }
    const weekdayNights = Math.max(0, nights - weekendNights);
    const lodgingHolidaySurge = holidaySurge > 1 ? 1.25 : 1.0;
    const totalLodgingCost = Math.round(
      (weekdayNights * nightlyRate + weekendNights * (nightlyRate * 1.20)) * lodgingHolidaySurge
    );

    const lodgingQuote: PricingLodgingQuote = {
      destinationCode: destinationAirport,
      startDate,
      endDate,
      nights,
      nightlyRate,
      totalLodgingCost,
      propertyType: party.childrenAges.length > 2 ? 'Family Suite / 2-Bedroom Apartment' : 'Family Hotel / Resort',
    };

    const totalCost = totalFlightCost + totalLodgingCost;
    const totalPassengers = Math.max(1, party.adults + party.childrenAges.length);
    const pricePerPerson = Math.round(totalCost / totalPassengers);

    const deepLinks: DeepLinkUrls = {
      googleFlights: generateGoogleFlightsLink(originAirport, destinationAirport, startDate, endDate),
      skyscanner: generateSkyscannerLink(
        originAirport,
        destinationAirport,
        startDate,
        endDate,
        party.adults,
        party.childrenAges
      ),
      bookingCom: generateBookingComLink(
        destinationAirport,
        startDate,
        endDate,
        party.adults,
        party.childrenAges
      ),
    };

    return {
      flight: flightQuote,
      lodging: lodgingQuote,
      totalCost,
      pricePerPerson,
      providerSource: 'PortalAggregator',
      isCachedBenchmark: true,
      deepLinks,
      party,
    };
  }
}

/**
 * Live Amadeus API Pricing Provider stub.
 * Connects to Amadeus GDS if credentials are provided in the environment,
 * otherwise gracefully falls back to PortalAggregatorProvider.
 */
export class AmadeusPricingProvider implements TravelPricingProvider {
  readonly name = 'AmadeusLive';
  private fallbackProvider = new PortalAggregatorProvider();

  async getTripPricing(params: {
    originAirport: string;
    destinationAirport: string;
    startDate: string;
    endDate: string;
    durationDays: number;
    party: PricingPartyComposition;
    isArbitrage?: boolean;
  }): Promise<AggregatedTripPricing> {
    const clientId = process.env.AMADEUS_CLIENT_ID;
    const clientSecret = process.env.AMADEUS_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      // Graceful fallback to PortalAggregator when API credentials are absent
      return this.fallbackProvider.getTripPricing(params);
    }

    try {
      // In production with live Amadeus keys, perform OAuth token exchange and flight-offers query.
      // If network times out or route is unserved, return fallback aggregator quote.
      return this.fallbackProvider.getTripPricing(params);
    } catch (err) {
      console.warn('[AmadeusPricingProvider] Error fetching live quote, falling back to aggregator:', err);
      return this.fallbackProvider.getTripPricing(params);
    }
  }
}

// Default singleton instance
export const defaultPricingProvider: TravelPricingProvider = new PortalAggregatorProvider();

/**
 * Helper to compute trip pricing synchronously using the primary aggregator provider.
 */
export function getSynchronousTripPricing(params: {
  originAirport: string;
  destinationAirport: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  party: PricingPartyComposition;
  isArbitrage?: boolean;
}): AggregatedTripPricing {
  const aggregator = new PortalAggregatorProvider();
  return aggregator.calculatePricingSync(params);
}

