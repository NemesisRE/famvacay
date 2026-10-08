import { calculateDistanceKm } from '@/lib/optimizer/arbitrage';

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

export const AIRPORTS_DATABASE: AirportOption[] = [
  // Germany
  { code: 'STR', name: 'Stuttgart Airport', city: 'Stuttgart', state: 'DE-BW', country: 'DE', lat: 48.6899, lon: 9.2220, isHub: true },
  { code: 'FKB', name: 'Karlsruhe/Baden-Baden', city: 'Baden-Baden', state: 'DE-BW', country: 'DE', lat: 48.7794, lon: 8.0805 },
  { code: 'FDH', name: 'Friedrichshafen Airport', city: 'Friedrichshafen', state: 'DE-BW', country: 'DE', lat: 47.6713, lon: 9.5115 },
  { code: 'FRA', name: 'Frankfurt Airport', city: 'Frankfurt', state: 'DE-HE', country: 'DE', lat: 50.0379, lon: 8.5622, isHub: true },
  { code: 'HHN', name: 'Frankfurt-Hahn', city: 'Hahn', state: 'DE-RP', country: 'DE', lat: 49.9487, lon: 7.2639 },
  { code: 'MUC', name: 'Munich Airport', city: 'Munich', state: 'DE-BY', country: 'DE', lat: 48.3537, lon: 11.7860, isHub: true },
  { code: 'NUE', name: 'Nuremberg Airport', city: 'Nuremberg', state: 'DE-BY', country: 'DE', lat: 49.4987, lon: 11.0780 },
  { code: 'FMM', name: 'Memmingen Airport', city: 'Memmingen', state: 'DE-BY', country: 'DE', lat: 47.9888, lon: 10.2395 },
  { code: 'BER', name: 'Berlin Brandenburg', city: 'Berlin', state: 'DE-BE', country: 'DE', lat: 52.3667, lon: 13.5033, isHub: true },
  { code: 'HAM', name: 'Hamburg Airport', city: 'Hamburg', state: 'DE-HH', country: 'DE', lat: 53.6304, lon: 9.9882, isHub: true },
  { code: 'DUS', name: 'Düsseldorf Airport', city: 'Düsseldorf', state: 'DE-NW', country: 'DE', lat: 51.2895, lon: 6.7668, isHub: true },
  { code: 'CGN', name: 'Cologne Bonn Airport', city: 'Cologne', state: 'DE-NW', country: 'DE', lat: 50.8659, lon: 7.1427 },
  { code: 'DTM', name: 'Dortmund Airport', city: 'Dortmund', state: 'DE-NW', country: 'DE', lat: 51.5183, lon: 7.6122 },
  { code: 'HAJ', name: 'Hannover Airport', city: 'Hannover', state: 'DE-NI', country: 'DE', lat: 52.4611, lon: 9.6850 },
  { code: 'BRE', name: 'Bremen Airport', city: 'Bremen', state: 'DE-HB', country: 'DE', lat: 53.0475, lon: 8.7867 },
  { code: 'LEJ', name: 'Leipzig/Halle Airport', city: 'Leipzig', state: 'DE-SN', country: 'DE', lat: 51.4239, lon: 12.2364 },
  { code: 'DRS', name: 'Dresden Airport', city: 'Dresden', state: 'DE-SN', country: 'DE', lat: 51.1328, lon: 13.7672 },

  // Switzerland & France Borders
  { code: 'BSL', name: 'EuroAirport Basel-Mulhouse-Freiburg', city: 'Basel/Mulhouse', state: 'CH-BS', country: 'CH', lat: 47.5896, lon: 7.5299, isHub: true },
  { code: 'ZRH', name: 'Zurich Airport', city: 'Zurich', state: 'CH-ZH', country: 'CH', lat: 47.4582, lon: 8.5555, isHub: true },
  { code: 'GVA', name: 'Geneva Airport', city: 'Geneva', state: 'CH-GE', country: 'CH', lat: 46.2381, lon: 6.1089, isHub: true },
  { code: 'SXB', name: 'Strasbourg Airport', city: 'Strasbourg', state: 'FR-GES', country: 'FR', lat: 48.5444, lon: 7.6282 },

  // Austria
  { code: 'VIE', name: 'Vienna International', city: 'Vienna', state: 'AT-9', country: 'AT', lat: 48.1103, lon: 16.5697, isHub: true },
  { code: 'SZG', name: 'Salzburg Airport', city: 'Salzburg', state: 'AT-5', country: 'AT', lat: 47.7944, lon: 13.0044 },
  { code: 'INN', name: 'Innsbruck Airport', city: 'Innsbruck', state: 'AT-7', country: 'AT', lat: 47.2602, lon: 11.3440 },

  // France
  { code: 'CDG', name: 'Paris Charles de Gaulle', city: 'Paris', state: 'FR-IDF', country: 'FR', lat: 49.0097, lon: 2.5479, isHub: true },
  { code: 'ORY', name: 'Paris Orly', city: 'Paris', state: 'FR-IDF', country: 'FR', lat: 48.7262, lon: 2.3652, isHub: true },
  { code: 'LYS', name: 'Lyon Saint-Exupéry', city: 'Lyon', state: 'FR-ARA', country: 'FR', lat: 45.7256, lon: 5.0811, isHub: true },
  { code: 'NCE', name: 'Nice Côte d’Azur', city: 'Nice', state: 'FR-PAC', country: 'FR', lat: 43.6584, lon: 7.2159 },

  // Spain
  { code: 'MAD', name: 'Madrid-Barajas', city: 'Madrid', state: 'ES-MD', country: 'ES', lat: 40.4839, lon: -3.5680, isHub: true },
  { code: 'BCN', name: 'Barcelona-El Prat', city: 'Barcelona', state: 'ES-CT', country: 'ES', lat: 41.2974, lon: 2.0833, isHub: true },
  { code: 'VLC', name: 'Valencia Airport', city: 'Valencia', state: 'ES-VC', country: 'ES', lat: 39.4893, lon: -0.4816 },

  // Italy
  { code: 'MXP', name: 'Milan Malpensa', city: 'Milan', state: 'IT-LOM', country: 'IT', lat: 45.6301, lon: 8.7255, isHub: true },
  { code: 'BGY', name: 'Milan Bergamo', city: 'Bergamo', state: 'IT-LOM', country: 'IT', lat: 45.6739, lon: 9.7042 },
  { code: 'FCO', name: 'Rome Fiumicino', city: 'Rome', state: 'IT-LAZ', country: 'IT', lat: 41.8003, lon: 12.2389, isHub: true },
  { code: 'VCE', name: 'Venice Marco Polo', city: 'Venice', state: 'IT-VEN', country: 'IT', lat: 45.5053, lon: 12.3519 },
];

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
    const distanceKm = calculateDistanceKm(center.lat, center.lon, airport.lat, airport.lon);
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
