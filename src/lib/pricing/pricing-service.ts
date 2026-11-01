import {
  AggregatedTripPricing,
  DeepLinkUrls,
  PricingFlightQuote,
  PricingLodgingQuote,
  PricingPartyComposition,
  TravelPricingProvider,
} from './types';
import { BoardType } from '../optimizer/types';
import { localMealPlanRates, mealPricePercentOfHome, MEAL_VALUE_CREDIT_SHARE, type MealPlanRates } from './meal-plan-value';
import { destinationCountryCode, getCountryPriceLevel } from './price-levels';
import { calculatePassengerCostMultiplier } from '../optimizer/child-tiers';
import { getAirportByIata, calculateGeodesicDistanceKm } from '../airports/airport-service';
import { getDestinationPoint } from '../geo/destination-points';
import { resolveFlightRoute } from '../airports/flight-routes';

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

export function resolveDestinationBoardType(
  destinationCode: string,
  userPreference?: BoardType
): BoardType {
  if (userPreference) return userPreference;

  const code = (destinationCode || '').toUpperCase();

  // All-inclusive dominant resort destinations
  const ALL_INCLUSIVE_HUBS = new Set([
    'PUJ', 'SDQ', 'CUN', 'CZM', 'MBJ', 'VRA', 'POP', 'LRM',
    'HRG', 'SSH', 'RMF', 'AAC',
    'AYT', 'BJV', 'DLM', 'GZP',
    'DJE', 'NBE', 'MIR',
    'MLE', 'SEZ', 'ZNZ', 'MBA'
  ]);

  if (ALL_INCLUSIVE_HUBS.has(code)) return 'ALL_INCLUSIVE';

  // Half-board dominant destinations (Alpine ski / mountain, resort islands)
  const HALF_BOARD_HUBS = new Set([
    'INN', 'SZG', 'BZO',
    'HER', 'RHO', 'KGS', 'CFU', 'CHQ',
    'PMI', 'IBZ', 'MAH', 'TFS', 'LPA', 'FUE', 'ACE', 'FNC',
    'DBV', 'SPU', 'ZAD', 'OLB', 'CAG'
  ]);

  if (HALF_BOARD_HUBS.has(code)) return 'HALF_BOARD';

  // European city breaks and cultural hubs typically offer Breakfast included
  return 'BREAKFAST';
}

/**
 * Non-linear hotel room occupancy topology (step function), modeling real-world family
 * room/rate cliffs rather than a smooth linear per-head scaling:
 * - Up to 2 adults + 1 child (+ max 1 infant <2y): 1.0x - standard double/triple room.
 * - 2 adults + 2 children (excluding infants): 1.35x - family studio / superior room.
 * - >= 3 children (excl. infants) OR >= 5 total travelers (excl. infants): 1.85x - 2 connecting
 *   rooms / 2-bedroom suite or apartment.
 */
export function calculateRoomOccupancyMultiplier(
  adults: number,
  childrenAges: number[]
): { multiplier: number; propertyType: string } {
  const nonInfantChildren = childrenAges.filter((age) => age >= 2).length;
  const totalExcludingInfants = adults + nonInfantChildren;

  if (nonInfantChildren >= 3 || totalExcludingInfants >= 5) {
    return { multiplier: 1.85, propertyType: '2 Connecting Rooms / 2-Bedroom Suite' };
  }
  if (nonInfantChildren === 2) {
    return { multiplier: 1.35, propertyType: 'Family Studio / Superior Room' };
  }
  return { multiplier: 1.0, propertyType: 'Standard Double/Triple Room' };
}

/**
 * DACH package-tour (Pauschalreise) destinations where tour operators (TUI, DERTOUR, FTI, ...)
 * commonly advertise a "Kinderfestpreis" - a flat, steeply discounted fixed price per child
 * that is markedly cheaper than booking flight + apartment modularly for larger families.
 */
export const PACKAGE_TOUR_DESTINATIONS = new Set([
  'PMI', 'IBZ', 'MAH', // Majorca / Ibiza / Menorca
  'HER', 'CHQ',        // Crete
  'RHO',                // Rhodes
  'AYT', 'DLM', 'BJV', 'GZP', // Antalya / Dalaman / Bodrum / Gazipasa
  'HRG', 'SSH', 'RMF',  // Hurghada / Sharm El Sheikh / Marsa Alam
  'TFS', 'LPA', 'FUE', 'ACE', // Canary Islands
]);

export interface PackageTourComparison {
  isPackageTourDestination: boolean;
  modularPriceEur: number;
  packagePriceEur: number;
  childFixedPriceEur: number;
  cheaperStrategy: 'PACKAGE' | 'MODULAR';
  savingsEur: number;
}

/**
 * Simulates the DACH "Kinderfestpreis" package-tour discount against the modular
 * (flight + apartment) booking strategy, and exposes whichever is cheaper.
 */
export function calculatePackageTourComparison(
  destinationCode: string,
  modularFlightCost: number,
  modularLodgingCost: number,
  adults: number,
  childrenAges: number[]
): PackageTourComparison | undefined {
  const code = (destinationCode || '').toUpperCase();
  if (!PACKAGE_TOUR_DESTINATIONS.has(code)) return undefined;

  const nonInfantChildren = childrenAges.filter((age) => age >= 2).length;
  if (nonInfantChildren === 0) return undefined;

  const modularPriceEur = Math.round(modularFlightCost + modularLodgingCost);

  // Kinderfestpreis: a fixed, steeply discounted child price (typically EUR 99-199 per child
  // for flight + half-board) when travelling with >= 1 adult pair in a shared room package.
  const childFixedPriceEur = 149;
  // Package operators price the adult share close to the modular benchmark (small bundling
  // discount of ~8%) but replace each non-infant child's share with the flat Kinderfestpreis.
  const perAdultModular = Math.round((modularFlightCost + modularLodgingCost) / Math.max(1, adults + nonInfantChildren));
  const packagePriceEur = Math.round(perAdultModular * adults * 0.92 + childFixedPriceEur * nonInfantChildren);

  const cheaperStrategy: 'PACKAGE' | 'MODULAR' = packagePriceEur <= modularPriceEur ? 'PACKAGE' : 'MODULAR';
  const savingsEur = Math.abs(modularPriceEur - packagePriceEur);

  return {
    isPackageTourDestination: true,
    modularPriceEur,
    packagePriceEur,
    childFixedPriceEur,
    cheaperStrategy,
    savingsEur,
  };
}

/**
 * Daily value of the included meals for the party, at the destination's price level (World Bank,
 * USA = 1; omitted = the Mediterranean reference the base values stand for).
 */
export function calculateMealPlanDailyValue(
  boardType: BoardType,
  adults: number,
  childrenAges: number[],
  priceLevel?: number
): { dailyAdult: number; dailyChild: number; totalDaily: number; priceFactor: number } {
  const { adult: dailyAdult, child: dailyChild, priceFactor } = localMealPlanRates(boardType, priceLevel);
  const childCount = childrenAges.length;
  const totalDaily = adults * dailyAdult + childCount * dailyChild;
  return { dailyAdult, dailyChild, totalDaily, priceFactor };
}

/**
 * Realistic Portal Aggregator Pricing Provider.
 * Models market pricing based on seasonal demand curves, passenger age tiers, cabin class, accommodation lengths, and board types.
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
    preferredBoardType?: BoardType;
    /** ISO country of the travellers' home, for comparing destination prices with home */
    homeCountry?: string;
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
    preferredBoardType?: BoardType;
    /** ISO country of the travellers' home, for comparing destination prices with home */
    homeCountry?: string;
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

    // Calculate geodesic flight corridor distance in km
    const origAirport = getAirportByIata(originAirport);
    const destAirport = getDestinationPoint(destinationAirport);
    let distKm = 1200; // default medium-haul baseline
    if (origAirport && destAirport) {
      distKm = calculateGeodesicDistanceKm(origAirport.lat, origAirport.lon, destAirport.lat, destAirport.lon);
    }

    // Distance-aware child fare: LCC short/medium-haul routes charge 95% adult fare for
    // ages 2-11, while long-haul (>= 4,500km) full-service carriers charge the classic 75%.
    const pCostMultiplier = calculatePassengerCostMultiplier(
      party.adults || 2,
      party.childrenAges || [],
      { distanceKm: distKm }
    );

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

    // Route logistics: Direct flight corridor vs connecting route with layovers
    const flightRoute = resolveFlightRoute(originAirport, destinationAirport);
    const routeMultiplier = flightRoute.isDirect
      ? flightRoute.directFlightPremiumMultiplier // e.g. 1.18 non-stop direct premium
      : (1.0 - flightRoute.connectingSavingsDiscount); // e.g. ~15% discount for 1 stop connecting route

    baseFlightFare = Math.round(baseFlightFare * flightDOWMultiplier * holidaySurge * routeMultiplier);

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
      airlineCarrier: flightRoute.isDirect
        ? 'Direct Flight Corridor (Aggregated)'
        : (flightRoute.stops === 1
            ? `Connecting via ${flightRoute.layovers[0]?.airportCode || 'Hub'}`
            : `Connecting (${flightRoute.stops} stops)`),
      isDirectFlight: flightRoute.isDirect,
      stops: flightRoute.stops,
      layovers: flightRoute.layovers,
      segments: flightRoute.segments,
      directFlightPremiumMultiplier: flightRoute.directFlightPremiumMultiplier,
      connectingSavingsDiscount: flightRoute.connectingSavingsDiscount,
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

    // Non-linear room occupancy topology: hotels enforce strict occupancy cliffs
    // (family studio / 2-bedroom suite) rather than smooth linear per-head scaling.
    const roomOccupancy = calculateRoomOccupancyMultiplier(party.adults || 2, party.childrenAges || []);
    nightlyRate = Math.round(nightlyRate * roomOccupancy.multiplier);

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
    const boardType = resolveDestinationBoardType(destinationAirport, params.preferredBoardType);
    // Meals cost what they cost at the destination: a full board is worth less in Thailand than in Greece
    const destinationPriceLevel = getCountryPriceLevel(destinationCountryCode(destAirport));
    const mealValueMeta = calculateMealPlanDailyValue(boardType, party.adults || 2, party.childrenAges || [], destinationPriceLevel);
    const totalMealValue = mealValueMeta.totalDaily * nights;
    const homePercent = mealPricePercentOfHome(destinationPriceLevel, getCountryPriceLevel(params.homeCountry));
    const mealPlanRates: MealPlanRates = {
      adult: mealValueMeta.dailyAdult,
      child: mealValueMeta.dailyChild,
      priceFactor: mealValueMeta.priceFactor,
      ...(params.homeCountry && homePercent !== undefined ? { homeComparison: { country: params.homeCountry.toUpperCase(), percent: homePercent } } : {}),
    };

    // Adjust rate if user explicitly chose an upgraded/downgraded board type
    if (params.preferredBoardType) {
      if (params.preferredBoardType === 'ALL_INCLUSIVE') {
        nightlyRate = Math.round(nightlyRate * 1.45);
      } else if (params.preferredBoardType === 'HALF_BOARD') {
        nightlyRate = Math.round(nightlyRate * 1.22);
      } else if (params.preferredBoardType === 'ROOM_ONLY') {
        nightlyRate = Math.round(nightlyRate * 0.88);
      }
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
      propertyType: roomOccupancy.propertyType,
      boardType,
      mealPlanValue: totalMealValue,
      mealPlanRates,
    };

    const totalCost = totalFlightCost + totalLodgingCost;
    const totalPassengers = Math.max(1, party.adults + party.childrenAges.length);
    const pricePerPerson = Math.round(totalCost / totalPassengers);
    const effectiveCost = Math.max(0, totalCost - Math.round(totalMealValue * MEAL_VALUE_CREDIT_SHARE));

    const packageTourDeal = calculatePackageTourComparison(
      destinationAirport,
      totalFlightCost,
      totalLodgingCost,
      party.adults || 2,
      party.childrenAges || []
    );

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
        // Surface (non-airport) destinations have no IATA code a hotel search could understand
        destAirport?.kind === 'SURFACE' ? `${destAirport.city}, ${destAirport.country}` : destinationAirport,
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
      boardType,
      mealPlanValue: totalMealValue,
      mealPlanRates,
      effectiveCost,
      providerSource: 'PortalAggregator',
      isCachedBenchmark: true,
      deepLinks,
      party,
      packageTourDeal,
    };
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
  preferredBoardType?: BoardType;
  homeCountry?: string;
}): AggregatedTripPricing {
  const aggregator = new PortalAggregatorProvider();
  return aggregator.calculatePricingSync(params);
}

