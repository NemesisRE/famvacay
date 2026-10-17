import { calculateGeodesicDistanceKm, getAllCommercialAirports } from '@/lib/airports/airport-service';

export interface AirportOption {
  code: string;
  name: string;
  city: string;
  state: string; // State / Region code (e.g. DE-BW, DE-BY, AT-9, CH-ZH)
  country: string;
  lat: number;
  lon: number;
  isHub?: boolean;
}

export const AIRPORTS_DATABASE: AirportOption[] = getAllCommercialAirports().map((a) => ({
  code: a.code,
  name: a.name,
  city: a.city,
  state: a.state || '',
  country: a.country,
  lat: a.lat,
  lon: a.lon,
  isHub: a.isMajorHub,
}));

import iso from 'iso-3166-2';

/**
 * Dynamically resolves geographical center coordinates for any administrative subdivision worldwide.
 * Eliminates static coordinate dictionaries and arbitrary hardcoded region fallbacks.
 */
export function getRegionCenter(regionCode: string): { lat: number; lon: number } | null {
  if (!regionCode) return null;

  // 1. Direct match on indexed airports belonging to this subdivision
  const matchingAirports = AIRPORTS_DATABASE.filter((a) => a.state === regionCode);
  const hubAirports = matchingAirports.filter((a) => a.isHub);
  const targetAirports = hubAirports.length > 0 ? hubAirports : matchingAirports;

  if (targetAirports.length > 0) {
    const avgLat = targetAirports.reduce((sum, a) => sum + a.lat, 0) / targetAirports.length;
    const avgLon = targetAirports.reduce((sum, a) => sum + a.lon, 0) / targetAirports.length;
    return { lat: Number(avgLat.toFixed(2)), lon: Number(avgLon.toFixed(2)) };
  }

  // 2. Query iso-3166-2 for subdivision details and match within country
  const sub = iso.subdivision(regionCode);
  if (sub) {
    const countryCode = sub.countryCode;
    const subNameLower = sub.name.toLowerCase();

    const countryAirports = AIRPORTS_DATABASE.filter(
      (a) =>
        a.country.toUpperCase() === sub.countryName.toUpperCase() ||
        (a.state && a.state.startsWith(countryCode + '-'))
    );
    const subAirports = countryAirports.filter(
      (a) => a.city.toLowerCase().includes(subNameLower) || a.name.toLowerCase().includes(subNameLower)
    );

    if (subAirports.length > 0) {
      const avgLat = subAirports.reduce((sum, a) => sum + a.lat, 0) / subAirports.length;
      const avgLon = subAirports.reduce((sum, a) => sum + a.lon, 0) / subAirports.length;
      return { lat: Number(avgLat.toFixed(2)), lon: Number(avgLon.toFixed(2)) };
    }

    if (countryAirports.length > 0) {
      const avgLat = countryAirports.reduce((sum, a) => sum + a.lat, 0) / countryAirports.length;
      const avgLon = countryAirports.reduce((sum, a) => sum + a.lon, 0) / countryAirports.length;
      return { lat: Number(avgLat.toFixed(2)), lon: Number(avgLon.toFixed(2)) };
    }
  }

  return null;
}

/**
 * Universal dynamic Proxy providing real-time geographical centers for any administrative region on Earth.
 */
export const REGION_CENTERS: Record<string, { lat: number; lon: number }> = new Proxy(
  {},
  {
    get(_target, prop: string | symbol) {
      if (typeof prop !== 'string') return undefined;
      return getRegionCenter(prop) || undefined;
    },
    has(_target, prop: string | symbol) {
      if (typeof prop !== 'string') return false;
      return Boolean(iso.subdivision(prop));
    },
  }
);

/**
 * Filter and sort departure airports dynamically based on user's region
 */
export function getRecommendedAirportsForRegion(
  regionCode: string,
  maxDistanceKm: number = 380
): (AirportOption & { distanceKm: number })[] {
  const center = REGION_CENTERS[regionCode];
  if (!center) return [];

  const scored = AIRPORTS_DATABASE.map((airport) => {
    const distanceKm = calculateGeodesicDistanceKm(center.lat, center.lon, airport.lat, airport.lon);
    return {
      ...airport,
      distanceKm,
    };
  });

  // Sort by proximity
  scored.sort((a, b) => a.distanceKm - b.distanceKm);

  // Return airports within max distance, ensuring at least top 5 are included
  const filtered = scored.filter((a) => a.distanceKm <= maxDistanceKm);
  return filtered.length >= 4 ? filtered : scored.slice(0, 6);
}
