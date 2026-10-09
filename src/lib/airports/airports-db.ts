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

// Approximate geographical centers of administrative regions for distance sorting
export const REGION_CENTERS: Record<string, { lat: number; lon: number }> = {
  // Germany
  'DE-BW': { lat: 48.66, lon: 9.35 },
  'DE-BY': { lat: 48.79, lon: 11.49 },
  'DE-BE': { lat: 52.52, lon: 13.40 },
  'DE-BB': { lat: 52.41, lon: 12.55 },
  'DE-HB': { lat: 53.07, lon: 8.80 },
  'DE-HH': { lat: 53.55, lon: 9.99 },
  'DE-HE': { lat: 50.65, lon: 9.16 },
  'DE-MV': { lat: 53.61, lon: 12.42 },
  'DE-NI': { lat: 52.63, lon: 9.84 },
  'DE-NW': { lat: 51.43, lon: 7.66 },
  'DE-RP': { lat: 49.91, lon: 7.45 },
  'DE-SL': { lat: 49.39, lon: 6.98 },
  'DE-SN': { lat: 51.10, lon: 13.20 },
  'DE-ST': { lat: 51.95, lon: 11.69 },
  'DE-SH': { lat: 54.21, lon: 9.69 },
  'DE-TH': { lat: 50.98, lon: 11.02 },

  // Austria
  'AT-1': { lat: 47.50, lon: 16.40 },
  'AT-2': { lat: 46.70, lon: 13.80 },
  'AT-3': { lat: 48.20, lon: 15.60 },
  'AT-4': { lat: 48.15, lon: 14.10 },
  'AT-5': { lat: 47.50, lon: 13.20 },
  'AT-6': { lat: 47.20, lon: 15.10 },
  'AT-7': { lat: 47.25, lon: 11.50 },
  'AT-8': { lat: 47.25, lon: 9.90 },
  'AT-9': { lat: 48.20, lon: 16.37 },

  // Switzerland
  'CH-BS': { lat: 47.55, lon: 7.59 },
  'CH-ZH': { lat: 47.37, lon: 8.54 },
  'CH-GE': { lat: 46.20, lon: 6.14 },
  'CH-BE': { lat: 46.94, lon: 7.44 },

  // France
  'FR-IDF': { lat: 48.85, lon: 2.35 },
  'FR-GES': { lat: 48.58, lon: 7.75 },
  'FR-ARA': { lat: 45.75, lon: 4.85 },
  'FR-PAC': { lat: 43.70, lon: 7.25 },

  // Spain
  'ES-MD': { lat: 40.41, lon: -3.70 },
  'ES-CT': { lat: 41.38, lon: 2.17 },
  'ES-AN': { lat: 37.38, lon: -5.98 },
  'ES-VC': { lat: 39.46, lon: -0.37 },

  // Italy
  'IT-LOM': { lat: 45.46, lon: 9.19 },
  'IT-LAZ': { lat: 41.90, lon: 12.49 },
  'IT-VEN': { lat: 45.44, lon: 12.31 },
};

/**
 * Filter and sort departure airports dynamically based on user's region
 */
export function getRecommendedAirportsForRegion(
  regionCode: string,
  maxDistanceKm: number = 380
): (AirportOption & { distanceKm: number })[] {
  const center = REGION_CENTERS[regionCode] || REGION_CENTERS['DE-BW'];

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
