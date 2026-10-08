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
  DTM: { code: 'DTM', name: 'Dortmund Airport', city: 'Dortmund', state: 'DE-NW', country: 'DE', lat: 51.5183, lon: 7.6122 },
  HAJ: { code: 'HAJ', name: 'Hannover Airport', city: 'Hannover', state: 'DE-NI', country: 'DE', lat: 52.4611, lon: 9.6850 },
  BRE: { code: 'BRE', name: 'Bremen Airport', city: 'Bremen', state: 'DE-HB', country: 'DE', lat: 53.0475, lon: 8.7867 },
  LEJ: { code: 'LEJ', name: 'Leipzig/Halle Airport', city: 'Leipzig', state: 'DE-SN', country: 'DE', lat: 51.4239, lon: 12.2364 },
  DRS: { code: 'DRS', name: 'Dresden Airport', city: 'Dresden', state: 'DE-SN', country: 'DE', lat: 51.1328, lon: 13.7672 },

  // Austria
  VIE: { code: 'VIE', name: 'Vienna International', city: 'Vienna', state: 'AT-9', country: 'AT', lat: 48.1103, lon: 16.5697 },
  SZG: { code: 'SZG', name: 'Salzburg Airport', city: 'Salzburg', state: 'AT-5', country: 'AT', lat: 47.7944, lon: 13.0044 },
  INN: { code: 'INN', name: 'Innsbruck Airport', city: 'Innsbruck', state: 'AT-7', country: 'AT', lat: 47.2602, lon: 11.3440 },

  // France & Switzerland
  GVA: { code: 'GVA', name: 'Geneva Airport', city: 'Geneva', state: 'CH-GE', country: 'CH', lat: 46.2381, lon: 6.1089 },
  CDG: { code: 'CDG', name: 'Paris Charles de Gaulle', city: 'Paris', state: 'FR-IDF', country: 'FR', lat: 49.0097, lon: 2.5479 },
  ORY: { code: 'ORY', name: 'Paris Orly', city: 'Paris', state: 'FR-IDF', country: 'FR', lat: 48.7262, lon: 2.3652 },
  LYS: { code: 'LYS', name: 'Lyon Saint-Exupéry', city: 'Lyon', state: 'FR-ARA', country: 'FR', lat: 45.7256, lon: 5.0811 },
  NCE: { code: 'NCE', name: 'Nice Côte d’Azur', city: 'Nice', state: 'FR-PAC', country: 'FR', lat: 43.6584, lon: 7.2159 },

  // Spain
  MAD: { code: 'MAD', name: 'Madrid-Barajas', city: 'Madrid', state: 'ES-MD', country: 'ES', lat: 40.4839, lon: -3.5680 },
  BCN: { code: 'BCN', name: 'Barcelona-El Prat', city: 'Barcelona', state: 'ES-CT', country: 'ES', lat: 41.2974, lon: 2.0833 },
  VLC: { code: 'VLC', name: 'Valencia Airport', city: 'Valencia', state: 'ES-VC', country: 'ES', lat: 39.4893, lon: -0.4816 },

  // Italy
  MXP: { code: 'MXP', name: 'Milan Malpensa', city: 'Milan', state: 'IT-LOM', country: 'IT', lat: 45.6301, lon: 8.7255 },
  BGY: { code: 'BGY', name: 'Milan Bergamo', city: 'Bergamo', state: 'IT-LOM', country: 'IT', lat: 45.6739, lon: 9.7042 },
  FCO: { code: 'FCO', name: 'Rome Fiumicino', city: 'Rome', state: 'IT-LAZ', country: 'IT', lat: 41.8003, lon: 12.2389 },
  VCE: { code: 'VCE', name: 'Venice Marco Polo', city: 'Venice', state: 'IT-VEN', country: 'IT', lat: 45.5053, lon: 12.3519 },
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

