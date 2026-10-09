import { POPULAR_DESTINATIONS, DestinationProfile } from './weather';
import { getAirportByIata } from '../airports/airport-service';

// Synonym and regional mapping table for flexible family destination matching
const DESTINATION_MAPPINGS: Record<string, string[]> = {
  // Egypt & Red Sea
  egypt: ['HRG', 'SSH'],
  ägypten: ['HRG', 'SSH'],
  egypte: ['HRG', 'SSH'],
  egipto: ['HRG', 'SSH'],
  egitto: ['HRG', 'SSH'],
  hurghada: ['HRG'],
  'sharm el sheikh': ['SSH'],
  'sharm el-sheikh': ['SSH'],
  'red sea': ['HRG', 'SSH'],
  rotes_meer: ['HRG', 'SSH'],

  // Tunisia
  tunisia: ['DJE'],
  tunesien: ['DJE'],
  tunisie: ['DJE'],
  túnez: ['DJE'],
  djerba: ['DJE'],

  // Turkey & Riviera
  turkey: ['AYT'],
  türkei: ['AYT'],
  turquie: ['AYT'],
  turquía: ['AYT'],
  turchia: ['AYT'],
  antalya: ['AYT'],
  'turkish riviera': ['AYT'],
  türkische_riviera: ['AYT'],

  // Spain & Islands
  spain: ['PMI', 'AGP', 'BCN'],
  spanien: ['PMI', 'AGP', 'BCN'],
  espagne: ['PMI', 'AGP', 'BCN'],
  españa: ['PMI', 'AGP', 'BCN'],
  spagna: ['PMI', 'AGP', 'BCN'],
  mallorca: ['PMI'],
  majorca: ['PMI'],
  palma: ['PMI'],
  ibiza: ['IBZ'],
  canaries: ['TFS', 'LPA'],
  kanaren: ['TFS', 'LPA'],
  tenerife: ['TFS'],
  'gran canaria': ['LPA'],
  malaga: ['AGP'],
  'costa del sol': ['AGP'],
  barcelona: ['BCN'],

  // Greece & Islands
  greece: ['HER', 'RHO', 'CFU'],
  griechenland: ['HER', 'RHO', 'CFU'],
  grèce: ['HER', 'RHO', 'CFU'],
  grecia: ['HER', 'RHO', 'CFU'],
  crete: ['HER'],
  kreta: ['HER'],
  heraklion: ['HER'],
  rhodes: ['RHO'],
  rhodos: ['RHO'],
  corfu: ['CFU'],
  kos: ['KGS'],

  // Italy
  italy: ['FCO', 'VCE'],
  italien: ['FCO', 'VCE'],
  italie: ['FCO', 'VCE'],
  italia: ['FCO', 'VCE'],
  rome: ['FCO'],
  rom: ['FCO'],
  venice: ['VCE'],
  venedig: ['VCE'],

  // Portugal
  portugal: ['FAO', 'LIS', 'FNC'],
  algarve: ['FAO'],
  faro: ['FAO'],
  lisbon: ['LIS'],
  lissabon: ['LIS'],
  madeira: ['FNC'],

  // Long-haul & Exotic
  bali: ['DPS'],
  indonesia: ['DPS'],
  thailand: ['HKT', 'BKK'],
  phuket: ['HKT'],
  bangkok: ['BKK'],
  cancun: ['CUN'],
  mexico: ['CUN'],
  mexiko: ['CUN'],
  dubai: ['DXB'],
  uae: ['DXB'],
};

// Ensure HRG, SSH, TFS, LPA, DJE are registered in POPULAR_DESTINATIONS if not present
if (!POPULAR_DESTINATIONS['HRG']) {
  POPULAR_DESTINATIONS['HRG'] = {
    code: 'HRG',
    name: 'Hurghada / Red Sea',
    country: 'EG',
    type: 'BEACH',
    lat: 27.1783,
    lon: 33.7994,
    idealMinTemp: 22,
    idealMaxTemp: 36,
    maxAcceptablePrecipRisk: 10,
  };
}
if (!POPULAR_DESTINATIONS['SSH']) {
  POPULAR_DESTINATIONS['SSH'] = {
    code: 'SSH',
    name: 'Sharm el Sheikh',
    country: 'EG',
    type: 'BEACH',
    lat: 27.9774,
    lon: 34.3951,
    idealMinTemp: 22,
    idealMaxTemp: 36,
    maxAcceptablePrecipRisk: 10,
  };
}
if (!POPULAR_DESTINATIONS['DJE']) {
  POPULAR_DESTINATIONS['DJE'] = {
    code: 'DJE',
    name: 'Djerba',
    country: 'TN',
    type: 'BEACH',
    lat: 33.8750,
    lon: 10.7753,
    idealMinTemp: 20,
    idealMaxTemp: 34,
    maxAcceptablePrecipRisk: 20,
  };
}
if (!POPULAR_DESTINATIONS['DPS']) {
  POPULAR_DESTINATIONS['DPS'] = {
    code: 'DPS',
    name: 'Bali Denpasar',
    country: 'ID',
    type: 'BEACH',
    lat: -8.7482,
    lon: 115.1672,
    idealMinTemp: 24,
    idealMaxTemp: 32,
    maxAcceptablePrecipRisk: 35,
  };
}
if (!POPULAR_DESTINATIONS['HKT']) {
  POPULAR_DESTINATIONS['HKT'] = {
    code: 'HKT',
    name: 'Phuket',
    country: 'TH',
    type: 'BEACH',
    lat: 8.1132,
    lon: 98.3169,
    idealMinTemp: 24,
    idealMaxTemp: 33,
    maxAcceptablePrecipRisk: 40,
  };
}

/**
 * Resolves user destination tags into valid candidate destination codes
 */
export function resolveDestinationCodes(destinationTags?: string[]): string[] {
  if (!destinationTags || destinationTags.length === 0) {
    // Default to top family vacation destinations
    return ['PMI', 'AYT', 'HRG', 'HER', 'AGP', 'FAO', 'BCN', 'DJE'];
  }

  const resolved = new Set<string>();

  for (const tag of destinationTags) {
    const clean = tag.trim().toLowerCase();
    const upper = tag.trim().toUpperCase();

    // Direct 3-letter IATA code
    if (upper.length === 3 && (POPULAR_DESTINATIONS[upper] || getAirportByIata(upper))) {
      resolved.add(upper);
      continue;
    }

    // Check mapping dictionary
    let found = false;
    for (const [key, codes] of Object.entries(DESTINATION_MAPPINGS)) {
      if (clean.includes(key) || key.includes(clean)) {
        codes.forEach((c) => resolved.add(c));
        found = true;
      }
    }

    // Check by destination name or country
    if (!found) {
      for (const [code, dest] of Object.entries(POPULAR_DESTINATIONS)) {
        if (
          dest.name.toLowerCase().includes(clean) ||
          dest.country.toLowerCase() === clean
        ) {
          resolved.add(code);
          found = true;
        }
      }
    }
  }

  if (resolved.size === 0) {
    return ['PMI', 'AYT', 'HRG', 'HER'];
  }

  return Array.from(resolved);
}

