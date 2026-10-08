export interface AirportInfo {
  code: string;
  name: string;
  city: string;
  state: string; // State / Region code (e.g. DE-BW, DE-BY, DE-HE, FR-67, CH-BS)
  country: string;
  lat: number;
  lon: number;
}

export const SUPPORTED_ORIGIN_AIRPORTS: Record<string, AirportInfo> = {
  // Germany - Baden-Württemberg
  STR: { code: 'STR', name: 'Stuttgart Airport', city: 'Stuttgart', state: 'DE-BW', country: 'DE', lat: 48.6899, lon: 9.2220 },
  FKB: { code: 'FKB', name: 'Karlsruhe/Baden-Baden', city: 'Baden-Baden', state: 'DE-BW', country: 'DE', lat: 48.7794, lon: 8.0805 },
  FDH: { code: 'FDH', name: 'Friedrichshafen Airport', city: 'Friedrichshafen', state: 'DE-BW', country: 'DE', lat: 47.6713, lon: 9.5115 },
  
  // Germany - Bavaria
  MUC: { code: 'MUC', name: 'Munich Airport', city: 'Munich', state: 'DE-BY', country: 'DE', lat: 48.3537, lon: 11.7860 },
  NUE: { code: 'NUE', name: 'Nuremberg Airport', city: 'Nuremberg', state: 'DE-BY', country: 'DE', lat: 49.4987, lon: 11.0780 },
  FMM: { code: 'FMM', name: 'Memmingen Airport', city: 'Memmingen', state: 'DE-BY', country: 'DE', lat: 47.9888, lon: 10.2395 },

  // Germany - Hesse & Rhineland-Palatinate
  FRA: { code: 'FRA', name: 'Frankfurt Airport', city: 'Frankfurt', state: 'DE-HE', country: 'DE', lat: 50.0379, lon: 8.5622 },
  HHN: { code: 'HHN', name: 'Frankfurt-Hahn', city: 'Hahn', state: 'DE-RP', country: 'DE', lat: 49.9487, lon: 7.2639 },

  // Switzerland / France (Border / Arbitrage)
  BSL: { code: 'BSL', name: 'EuroAirport Basel-Mulhouse-Freiburg', city: 'Basel/Mulhouse', state: 'CH-BS', country: 'CH', lat: 47.5896, lon: 7.5299 },
  ZRH: { code: 'ZRH', name: 'Zurich Airport', city: 'Zurich', state: 'CH-ZH', country: 'CH', lat: 47.4582, lon: 8.5555 },
  SXB: { code: 'SXB', name: 'Strasbourg Airport', city: 'Strasbourg', state: 'FR-67', country: 'FR', lat: 48.5444, lon: 7.6282 },

  // Germany - North/East/West
  BER: { code: 'BER', name: 'Berlin Brandenburg', city: 'Berlin', state: 'DE-BE', country: 'DE', lat: 52.3667, lon: 13.5033 },
  HAM: { code: 'HAM', name: 'Hamburg Airport', city: 'Hamburg', state: 'DE-HH', country: 'DE', lat: 53.6304, lon: 9.9882 },
  DUS: { code: 'DUS', name: 'Düsseldorf Airport', city: 'Düsseldorf', state: 'DE-NW', country: 'DE', lat: 51.2895, lon: 6.7668 },
  CGN: { code: 'CGN', name: 'Cologne Bonn Airport', city: 'Cologne', state: 'DE-NW', country: 'DE', lat: 50.8659, lon: 7.1427 },
};

export const NEIGHBORING_STATES: Record<string, string[]> = {
  'DE-BW': ['DE-BY', 'DE-HE', 'DE-RP', 'CH-BS', 'FR-67'],
  'DE-BY': ['DE-BW', 'DE-HE', 'DE-TH', 'DE-SN', 'AT-TIR'],
  'DE-HE': ['DE-BW', 'DE-BY', 'DE-RP', 'DE-NW', 'DE-NI', 'DE-TH'],
  'DE-NW': ['DE-RP', 'DE-HE', 'DE-NI', 'NL'],
  'DE-BE': ['DE-BB'],
  'DE-HH': ['DE-SH', 'DE-NI'],
};

/**
 * Haversine distance in kilometers
 */
export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Identify if an origin airport is outside the user's home state (arbitrage candidate).
 */
export function isArbitrageAirport(userHomeState: string, airportCode: string): boolean {
  const airport = SUPPORTED_ORIGIN_AIRPORTS[airportCode];
  if (!airport) return false;
  return airport.state !== userHomeState;
}

