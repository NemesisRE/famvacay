import { getDistance } from 'geolib';

// Import raw airport data (7,184 worldwide airports)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const rawAirports: any[] = require('airport-data');

export interface DynamicAirport {
  code: string;       // 3-letter IATA code
  icao: string;       // 4-letter ICAO code
  name: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
  state?: string;     // Administrative subdivision (e.g. DE-BW, FR-IDF, AT-9)
  distanceKm?: number;
  isHighSpeedRailConnected?: boolean;
  railConnectivityNote?: string;
  flightCorridorNote?: string;
  isMajorHub?: boolean;
}

// Major commercial airline hubs in Europe and globally
const KNOWN_MAJOR_HUBS = new Set([
  'FRA', 'MUC', 'STR', 'BER', 'HAM', 'DUS', 'CGN', 'FKB', 'NUE', 'HAJ', 'BRE', 'LEJ', 'DRS', 'FMM', 'FDH', 'HHN', 'SCN',
  'CDG', 'ORY', 'LYS', 'NCE', 'MRS', 'SXB', 'TLS', 'BOD', 'NTE',
  'AMS', 'BRU', 'LUX',
  'ZRH', 'GVA', 'BSL',
  'VIE', 'SZG', 'INN', 'GRZ', 'LNZ', 'KLU',
  'LHR', 'LGW', 'STN', 'MAN', 'EDI',
  'MAD', 'BCN', 'AGP', 'VLC', 'ALC', 'SVQ', 'PMI', 'IBZ',
  'FCO', 'MXP', 'BGY', 'LIN', 'VCE', 'BLQ', 'NAP', 'CTA', 'PMO',
  'LIS', 'OPO', 'FAO',
  'CPH', 'OSL', 'ARN', 'HEL',
  'WAW', 'KRK', 'PRG', 'BUD',
  'ATH', 'HER', 'SKG', 'RHO', 'CFU',
  'IST', 'SAW', 'AYT',
  'DXB', 'DOH', 'BKK', 'HND', 'NRT', 'SIN', 'JFK', 'ORD', 'LAX', 'MIA', 'CUN'
]);

// Administrative subdivision mapping for key European airports
const AIRPORT_STATE_MAPPING: Record<string, string> = {
  // Germany
  STR: 'DE-BW', FKB: 'DE-BW', FDH: 'DE-BW',
  MUC: 'DE-BY', NUE: 'DE-BY', FMM: 'DE-BY',
  FRA: 'DE-HE', KSF: 'DE-HE',
  HHN: 'DE-RP',
  BER: 'DE-BE',
  HAM: 'DE-HH',
  DUS: 'DE-NW', CGN: 'DE-NW', DTM: 'DE-NW', FMO: 'DE-NW',
  HAJ: 'DE-NI', BRE: 'DE-HB',
  LEJ: 'DE-SN', DRS: 'DE-SN',
  SCN: 'DE-SL', RLG: 'DE-MV',
  // France
  CDG: 'FR-IDF', ORY: 'FR-IDF', BVA: 'FR-HDF',
  SXB: 'FR-GES', LYS: 'FR-ARA', NCE: 'FR-PAC', MRS: 'FR-PAC',
  // Switzerland
  BSL: 'CH-BS', ZRH: 'CH-ZH', GVA: 'CH-GE', BRN: 'CH-BE',
  // Austria
  VIE: 'AT-9', SZG: 'AT-5', INN: 'AT-7', GRZ: 'AT-6', LNZ: 'AT-4', KLU: 'AT-2',
  // Spain
  MAD: 'ES-MD', BCN: 'ES-CT', VLC: 'ES-VC', AGP: 'ES-AN', SVQ: 'ES-AN', PMI: 'ES-IB',
  // Italy
  MXP: 'IT-LOM', BGY: 'IT-LOM', LIN: 'IT-LOM', FCO: 'IT-LAZ', VCE: 'IT-VEN',
};

// Index valid commercial IATA airports
const indexedAirports: DynamicAirport[] = rawAirports
  .filter((a) => a.iata && a.iata.length === 3 && a.iata !== '\\N')
  .map((a) => {
    const code = a.iata.toUpperCase();
    return {
      code,
      icao: a.icao || '',
      name: a.name || '',
      city: a.city || '',
      country: a.country || '',
      lat: Number(a.latitude),
      lon: Number(a.longitude),
      state: AIRPORT_STATE_MAPPING[code] || (a.country === 'Germany' ? 'DE-BW' : undefined),
      isMajorHub: KNOWN_MAJOR_HUBS.has(code),
    };
  });

const airportByIataMap = new Map<string, DynamicAirport>();
for (const a of indexedAirports) {
  airportByIataMap.set(a.code, a);
}

// Add modern Berlin Brandenburg (BER) if missing from older airport-data dumps
if (!airportByIataMap.has('BER')) {
  const berAirport: DynamicAirport = {
    code: 'BER',
    icao: 'EDDB',
    name: 'Berlin Brandenburg Airport Willy Brandt',
    city: 'Berlin',
    country: 'Germany',
    lat: 52.3667,
    lon: 13.5033,
    state: 'DE-BE',
    isMajorHub: true,
  };
  indexedAirports.unshift(berAirport);
  airportByIataMap.set('BER', berAirport);
}

/**
 * Retrieve airport details by IATA code
 */
export function getAirportByIata(code: string): DynamicAirport | undefined {
  if (!code) return undefined;
  return airportByIataMap.get(code.toUpperCase());
}

/**
 * Calculate geodesic distance in kilometers between two coordinate pairs
 */
export function calculateGeodesicDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const meters = getDistance(
    { latitude: lat1, longitude: lon1 },
    { latitude: lat2, longitude: lon2 }
  );
  return Math.round(meters / 1000);
}

/**
 * Evaluate High-Speed Rail (HSR) connectivity from departure location
 * Special corridor: Karlsruhe / Southwest Germany / Alsace -> Paris hubs (CDG / ORY)
 * Direct TGV / ICE connects Karlsruhe to Paris in 2.5 hours, providing huge long-haul/Caribbean savings
 */
function evaluateHighSpeedRailConnectivity(
  userLat: number,
  userLon: number,
  airportCode: string
): { isConnected: boolean; note?: string } {
  // Paris Hubs (CDG, ORY)
  if (airportCode === 'CDG' || airportCode === 'ORY') {
    // Southwest Germany, Baden-Württemberg, Alsace, Saarland, Frankfurt/Rhine corridor
    // Lat: ~47.5 to ~50.5, Lon: ~6.0 to ~9.5
    const isSwGermanyOrRhine =
      userLat >= 47.4 && userLat <= 50.5 && userLon >= 6.0 && userLon <= 9.5;
    
    // Or geodesic distance within 470km of Paris
    const distToParis = calculateGeodesicDistanceKm(userLat, userLon, 48.8566, 2.3522);

    if (isSwGermanyOrRhine || distToParis <= 470) {
      return {
        isConnected: true,
        note: 'Direct TGV / ICE (~2.5h) with direct Caribbean & long-haul flight savings',
      };
    }
  }

  // Brussels Hub (BRU) for Rhineland / Cologne / Aachen
  if (airportCode === 'BRU') {
    const isRhineland = userLat >= 50.4 && userLat <= 51.5 && userLon >= 5.8 && userLon <= 7.5;
    if (isRhineland) {
      return {
        isConnected: true,
        note: 'Direct Eurostar / ICE (~1.8h) connection',
      };
    }
  }

  // Amsterdam Hub (AMS) for Ruhr / Lower Rhine
  if (airportCode === 'AMS') {
    const isRuhr = userLat >= 51.1 && userLat <= 52.5 && userLon >= 5.8 && userLon <= 7.5;
    if (isRuhr) {
      return {
        isConnected: true,
        note: 'Direct ICE to Schiphol airport (~2.2h)',
      };
    }
  }

  // Frankfurt Hub (FRA) via AIRail
  if (airportCode === 'FRA') {
    const distToFra = calculateGeodesicDistanceKm(userLat, userLon, 50.0379, 8.5622);
    if (distToFra > 50 && distToFra <= 220) {
      return {
        isConnected: true,
        note: 'Direct ICE AIRail straight to airport terminal (<1h)',
      };
    }
  }

  return { isConnected: false };
}

/**
 * Dynamically recommend departure airports based strictly on starting coordinates.
 * Includes proximity airports plus connected high-speed rail mega-hubs.
 */
export function getRecommendedAirportsForCoordinates(
  userLat: number,
  userLon: number,
  maxDistanceKm: number = 380,
  targetDestinations?: string[]
): DynamicAirport[] {
  const normalizedDestinations = (targetDestinations || []).map((d) => d.toLowerCase());
  const hasLongHaulDestinations = normalizedDestinations.some((d) =>
    ['egypt', 'hurghada', 'bali', 'thailand', 'phuket', 'cancun', 'dubai', 'caribbean', 'hrg', 'ssh', 'dps', 'hkt', 'cun', 'dxb', 'bkk'].some((kw) => d.includes(kw))
  );

  // Score all major/known hubs
  const candidateHubs = indexedAirports.filter(
    (a) => a.isMajorHub || ['STR', 'FKB', 'FRA', 'MUC', 'BSL', 'ZRH', 'CDG', 'ORY', 'VIE', 'BER', 'HAM', 'DUS', 'CGN'].includes(a.code)
  );

  const scored: DynamicAirport[] = candidateHubs.map((airport) => {
    const distanceKm = calculateGeodesicDistanceKm(userLat, userLon, airport.lat, airport.lon);
    const rail = evaluateHighSpeedRailConnectivity(userLat, userLon, airport.code);

    let flightCorridorNote: string | undefined;
    if (hasLongHaulDestinations && ['FRA', 'CDG', 'MUC', 'ZRH'].includes(airport.code)) {
      flightCorridorNote = 'Direct intercontinental long-haul corridor';
    } else if (normalizedDestinations.length > 0 && ['STR', 'FKB', 'BSL', 'NUE', 'DUS', 'CGN'].includes(airport.code)) {
      flightCorridorNote = 'Direct holiday charter corridor';
    }

    return {
      ...airport,
      distanceKm,
      isHighSpeedRailConnected: rail.isConnected,
      railConnectivityNote: rail.note,
      flightCorridorNote,
    };
  });

  // Separate local proximity airports and HSR connected hubs
  const nearby = scored
    .filter((a) => (a.distanceKm ?? 99999) <= maxDistanceKm && !a.isHighSpeedRailConnected)
    .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));

  const hsrHubs = scored
    .filter((a) => a.isHighSpeedRailConnected)
    .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));

  // Combine: nearest local airports (up to 7) + high-speed rail hubs (e.g. CDG, ORY, FRA)
  const combined: DynamicAirport[] = [];
  const addedCodes = new Set<string>();

  // Add top nearby local airports
  for (const a of nearby.slice(0, 7)) {
    if (!addedCodes.has(a.code)) {
      combined.push(a);
      addedCodes.add(a.code);
    }
  }

  // Add HSR connected mega-hubs
  for (const a of hsrHubs) {
    if (!addedCodes.has(a.code)) {
      combined.push(a);
      addedCodes.add(a.code);
    }
  }

  // If long-haul destinations selected, ensure Frankfurt (FRA) or Paris (CDG) are included
  if (hasLongHaulDestinations) {
    for (const code of ['FRA', 'CDG', 'MUC']) {
      const hub = scored.find((a) => a.code === code);
      if (hub && !addedCodes.has(code)) {
        combined.push(hub);
        addedCodes.add(code);
      }
    }
  }

  // Sort final list by distance, keeping HSR hubs prominently displayed
  return combined.slice(0, 10);
}

/**
 * Free-text airport search across 5,600+ airports worldwide
 * Supports search by IATA code, city name, airport name, or country
 */
export function searchAirports(
  query: string,
  userCoords?: { lat: number; lon: number },
  limit: number = 10
): DynamicAirport[] {
  const q = query.trim().toUpperCase();
  if (!q) return [];

  const matched = indexedAirports.filter((a) => {
    if (a.code === q) return true;
    if (a.code.startsWith(q)) return true;
    if (a.city.toUpperCase().includes(q)) return true;
    if (a.name.toUpperCase().includes(q)) return true;
    if (a.country.toUpperCase().includes(q)) return true;
    return false;
  });

  // If user coordinates provided, attach distances
  const enriched = matched.map((a) => {
    if (userCoords) {
      const distanceKm = calculateGeodesicDistanceKm(userCoords.lat, userCoords.lon, a.lat, a.lon);
      const rail = evaluateHighSpeedRailConnectivity(userCoords.lat, userCoords.lon, a.code);
      return {
        ...a,
        distanceKm,
        isHighSpeedRailConnected: rail.isConnected,
        railConnectivityNote: rail.note,
      };
    }
    return a;
  });

  // Sort: Exact IATA match first, then major hubs, then proximity if coords given
  enriched.sort((a, b) => {
    if (a.code === q) return -1;
    if (b.code === q) return 1;
    if (a.code.startsWith(q) && !b.code.startsWith(q)) return -1;
    if (!a.code.startsWith(q) && b.code.startsWith(q)) return 1;
    if (a.isMajorHub && !b.isMajorHub) return -1;
    if (!a.isMajorHub && b.isMajorHub) return 1;
    if (a.distanceKm !== undefined && b.distanceKm !== undefined) {
      return a.distanceKm - b.distanceKm;
    }
    return a.city.localeCompare(b.city);
  });

  return enriched.slice(0, limit);
}
