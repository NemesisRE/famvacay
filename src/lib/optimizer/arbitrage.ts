import { calculateGeodesicDistanceKm, getAirportByIata } from '@/lib/airports/airport-service';

export interface AirportInfo {
  code: string;
  name: string;
  city: string;
  state: string; // State / Region code (e.g. DE-BW, DE-BY, DE-HE, FR-67, CH-BS)
  country: string;
  lat: number;
  lon: number;
}

/**
 * Dynamic resolver for origin airport metadata (powered by airport-service / airport-data)
 */
export function getOriginAirportInfo(airportCode: string): AirportInfo | null {
  const airport = getAirportByIata(airportCode);
  if (!airport) return null;
  return {
    code: airport.code,
    name: airport.name,
    city: airport.city,
    state: airport.state || '',
    country: airport.country,
    lat: airport.lat,
    lon: airport.lon,
  };
}

/**
 * Dynamic Proxy providing backwards-compatible dictionary access for any commercial IATA airport
 * without requiring any static hardcoded airport list.
 */
export const SUPPORTED_ORIGIN_AIRPORTS: Record<string, AirportInfo> = new Proxy(
  {},
  {
    get(_target, prop: string | symbol) {
      if (typeof prop !== 'string') return undefined;
      return getOriginAirportInfo(prop) || undefined;
    },
    has(_target, prop: string | symbol) {
      if (typeof prop !== 'string') return false;
      return Boolean(getAirportByIata(prop));
    },
  }
);

/**
 * Geodesic distance in kilometers (powered by geolib)
 */
export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  return calculateGeodesicDistanceKm(lat1, lon1, lat2, lon2);
}

/**
 * Identify if an origin airport is outside the user's home state (arbitrage candidate).
 */
export function isArbitrageAirport(userHomeState: string, airportCode: string): boolean {
  const dynamicAirport = getAirportByIata(airportCode);
  if (dynamicAirport?.state) {
    return dynamicAirport.state !== userHomeState;
  }
  return false;
}
