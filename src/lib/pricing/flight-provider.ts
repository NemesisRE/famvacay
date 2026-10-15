import { getCached, setCached } from '../cache/redis';
import { getAirportByIata, calculateGeodesicDistanceKm } from '../airports/airport-service';

const TTL_12_HOURS = 12 * 60 * 60;

export interface PassengerTiers {
  adults: number;
  children: number;
  infants: number;
}

export interface FlightPriceRequest {
  origin: string;
  destination: string;
  departureDate: string; // YYYY-MM-DD
  returnDate: string;    // YYYY-MM-DD
  passengers: PassengerTiers;
}

export interface FlightPriceResult {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate: string;
  totalCost: number;
  perPersonCost: number;
  currency: string;
  isCachedBenchmark: boolean;
  benchmarkDate?: string;
  breakdownByTier?: {
    adultFare: number;
    childFare: number;
    infantFare: number;
  };
}

export interface FlightPriceProvider {
  name: string;
  getFlightPrices(req: FlightPriceRequest): Promise<FlightPriceResult>;
}

/**
 * Benchmark Flight Pricing Provider
 * Provider-agnostic calculation based on Great-Circle geodesic distance,
 * seasonal demand curves, and industry standard age multipliers:
 * - Infants (<2 yrs): ~10% fare
 * - Children (2–11 yrs): ~75% fare
 * - Adults (12+ yrs): 100% fare
 */
export class BenchmarkFlightProvider implements FlightPriceProvider {
  public readonly name = 'BenchmarkEstimationProvider';

  async getFlightPrices(req: FlightPriceRequest): Promise<FlightPriceResult> {
    const { origin, destination, departureDate, returnDate, passengers } = req;
    const originAirport = getAirportByIata(origin);
    const destAirport = getAirportByIata(destination);

    let distanceKm = 1200; // sensible default continental corridor
    if (originAirport && destAirport) {
      distanceKm = Math.round(
        calculateGeodesicDistanceKm(
          originAirport.lat,
          originAirport.lon,
          destAirport.lat,
          destAirport.lon
        )
      );
    }

    // Base fare modeled on distance bands:
    // Short-haul (<1500km): ~€90–€160 base
    // Medium-haul (1500–4000km): ~€160–€320 base
    // Long-haul (>4000km): ~€450–€850 base
    let baseAdultFare = 110;
    if (distanceKm < 1500) {
      baseAdultFare = 85 + Math.round((distanceKm / 1500) * 65);
    } else if (distanceKm < 4000) {
      baseAdultFare = 150 + Math.round(((distanceKm - 1500) / 2500) * 160);
    } else {
      baseAdultFare = 380 + Math.round(((distanceKm - 4000) / 6000) * 450);
    }

    // Seasonal curve based on departure month (0-indexed)
    const depMonth = new Date(departureDate).getMonth();
    let seasonalMultiplier = 1.0;
    if (depMonth >= 5 && depMonth <= 7) {
      seasonalMultiplier = 1.45; // Summer peak
    } else if (depMonth === 11 || depMonth === 0) {
      seasonalMultiplier = 1.25; // Holiday peak
    } else if (depMonth === 3 || depMonth === 9) {
      seasonalMultiplier = 1.15; // Shoulder season
    }

    const adultFare = Math.round(baseAdultFare * seasonalMultiplier);
    const childFare = Math.round(adultFare * 0.75);
    const infantFare = Math.round(adultFare * 0.10);

    const totalCost =
      adultFare * passengers.adults +
      childFare * passengers.children +
      infantFare * passengers.infants;

    const totalPax = Math.max(1, passengers.adults + passengers.children + passengers.infants);

    return {
      origin,
      destination,
      departureDate,
      returnDate,
      totalCost,
      perPersonCost: Math.round(totalCost / totalPax),
      currency: 'EUR',
      isCachedBenchmark: true,
      benchmarkDate: new Date().toISOString().split('T')[0],
      breakdownByTier: {
        adultFare,
        childFare,
        infantFare,
      },
    };
  }
}

const defaultProvider: FlightPriceProvider = new BenchmarkFlightProvider();

/**
 * Universal Flight Pricing Dispatcher
 * Cached in Redis with TTL = 12 hours (key: flights:v1:origin_destination_dates_paxByTier)
 */
export async function getFlightPrices(
  origin: string,
  destination: string,
  departureDate: string,
  returnDate: string,
  adultsCount: number,
  childrenAges: number[]
): Promise<FlightPriceResult> {
  const infants = childrenAges.filter((a) => a < 2).length;
  const children = childrenAges.filter((a) => a >= 2 && a <= 11).length;
  const adultChildren = childrenAges.filter((a) => a > 11).length;
  const totalAdults = adultsCount + adultChildren;

  const paxKey = `a${totalAdults}_c${children}_i${infants}`;
  const cacheKey = `flights:v1:${origin}_${destination}_${departureDate}_${returnDate}_${paxKey}`;

  const cached = await getCached<FlightPriceResult>(cacheKey);
  if (cached) {
    return cached;
  }

  const result = await defaultProvider.getFlightPrices({
    origin,
    destination,
    departureDate,
    returnDate,
    passengers: {
      adults: totalAdults,
      children,
      infants,
    },
  });

  await setCached(cacheKey, result, TTL_12_HOURS);
  return result;
}

