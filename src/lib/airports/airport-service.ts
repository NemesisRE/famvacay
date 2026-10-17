import { getDistance } from 'geolib';

// Import raw airport data (7,184 worldwide airports)
// @ts-expect-error airport-data package lacks typescript definitions
import rawAirportsData from 'airport-data';

const rawAirports: any[] = rawAirportsData as any[];

export interface DynamicAirport {
  code: string;       // 3-letter IATA code
  icao: string;       // 4-letter ICAO code
  name: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
  altitude?: number;  // Elevation in feet above sea level
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

/**
 * Backward compatibility export. All airport operations are purely dynamic.
 */
export const LOCALIZED_AIRPORT_METADATA: Record<
  string,
  {
    name?: Record<string, string>;
    city?: Record<string, string>;
    state?: string;
    isMajorHub?: boolean;
  }
> = {};

export function getLocalizedAirportDetails(airport: DynamicAirport, locale: string = 'en'): DynamicAirport {
  const loc = (locale || 'en').toLowerCase().slice(0, 2);
  let localizedCountry = airport.country;
  if (airport.state) {
    try {
      const cCode = airport.state.split('-')[0];
      const enRegion = new Intl.DisplayNames([loc], { type: 'region' });
      const cName = enRegion.of(cCode);
      if (cName) localizedCountry = cName;
    } catch {
      // Non-critical localization fallback
    }
  }

  const meta = LOCALIZED_AIRPORT_METADATA[airport.code];
  if (!meta) {
    return {
      ...airport,
      country: localizedCountry,
    };
  }

  return {
    ...airport,
    name: meta.name?.[loc] || meta.name?.en || airport.name,
    city: meta.city?.[loc] || meta.city?.en || airport.city,
    state: meta.state || airport.state,
    isMajorHub: meta.isMajorHub ?? airport.isMajorHub,
    country: localizedCountry,
  };
}

// Excluded non-commercial, military, or decommissioned airfields
export const EXCLUDED_NON_COMMERCIAL_AIRPORTS = new Set([
  // Military Air Bases & Air Stations
  'RMS', 'SPM', 'GKE', 'GUT', 'GHF', 'ZNF', 'NDZ', 'QMI', 'AVB', 'VVI',
  // Decommissioned / closed airports
  'TXL', 'THF', 'SXF', 'BBS', 'HEW',
  // Small general aviation, private airstrips, glider fields
  'QEF', 'MHG', 'ZQC', 'ZQF', 'ZNV', 'ZQL', 'ZQW', 'BYU', 'HOQ', 'AAH', 'LHA',
  'CSO', 'PEF', 'BBJ', 'EUM', 'FNB', 'ZCA', 'ESS', 'MGL', 'OBF', 'RBM', 'SZW',
  'ZSN', 'BWE', 'BRV', 'FLF', 'BBH', 'AOC', 'KEL', 'EBE', 'EMP', 'ESX', 'LND',
  'QFB', 'BFE', 'QFD', 'ELT', 'SKV',
]);

export const NON_COMMERCIAL_KEYWORDS = [
  'air base',
  'airbase',
  ' afb',
  'army air',
  'naval air',
  'militär',
  'military',
  'heliport',
  'helipad',
  'glider',
  'segelflug',
  'segelflugplatz',
  'sportflug',
  'ultralight',
  'airstrip',
  '[duplicate]',
];

export function isCommercialPassengerAirport(airport: {
  iata?: string;
  code?: string;
  name: string;
  city?: string;
  isMajorHub?: boolean;
}): boolean {
  const code = (airport.code || airport.iata || '').toUpperCase();
  if (!code || code.length !== 3 || code === '\\N') {
    return false;
  }

  // Explicit military / non-commercial exclusion set
  if (EXCLUDED_NON_COMMERCIAL_AIRPORTS.has(code)) {
    return false;
  }

  // If designated as a known major commercial hub or metadata major hub, preserve
  if (KNOWN_MAJOR_HUBS.has(code) || airport.isMajorHub) {
    return true;
  }

  const nameLower = (airport.name || '').toLowerCase();
  const cityLower = (airport.city || '').toLowerCase();

  // Keyword check for military, gliders, heliports
  for (const kw of NON_COMMERCIAL_KEYWORDS) {
    if (nameLower.includes(kw) || cityLower.includes(kw)) {
      return false;
    }
  }

  return true;
}

// Index valid commercial IATA airports
const indexedAirports: DynamicAirport[] = rawAirports
  .filter((a) => a.iata && a.iata.length === 3 && a.iata !== '\\N' && isCommercialPassengerAirport(a))
  .map((a) => {
    const code = a.iata.toUpperCase();
    const meta = LOCALIZED_AIRPORT_METADATA[code];
    return {
      code,
      icao: a.icao || '',
      name: meta?.name?.en || a.name || '',
      city: meta?.city?.en || a.city || '',
      country: a.country || '',
      lat: Number(a.latitude),
      lon: Number(a.longitude),
      altitude: Number(a.altitude) || 0,
      state: meta?.state || AIRPORT_STATE_MAPPING[code] || undefined,
      isMajorHub: meta?.isMajorHub ?? KNOWN_MAJOR_HUBS.has(code),
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
export function getAirportByIata(code: string, locale?: string): DynamicAirport | undefined {
  if (!code) return undefined;
  const ap = airportByIataMap.get(code.toUpperCase());
  if (!ap) return undefined;
  return locale ? getLocalizedAirportDetails(ap, locale) : ap;
}

/**
 * Returns all indexed commercial passenger airports
 */
export function getAllCommercialAirports(): DynamicAirport[] {
  return indexedAirports;
}

/**
 * Dynamically resolves major commercial passenger airports serving a sovereign nation
 */
export function getMajorAirportsForCountry(countryCodeOrName: string): string[] {
  const clean = countryCodeOrName.trim();
  if (!clean) return [];

  let targetCountryName = clean.toLowerCase();
  if (clean.length === 2) {
    try {
      const enRegion = new Intl.DisplayNames(['en'], { type: 'region' });
      const resolved = enRegion.of(clean.toUpperCase());
      if (resolved) targetCountryName = resolved.toLowerCase();
    } catch {
      // Fall through to direct match
    }
  }

  const matched = indexedAirports.filter((a) => {
    const c = a.country.toLowerCase();
    const st = (a.state || '').toLowerCase();
    return c === targetCountryName || (clean.length === 2 && st.startsWith(clean.toLowerCase() + '-'));
  });

  // Prioritize major airline hubs first
  matched.sort((a, b) => (b.isMajorHub ? 1 : 0) - (a.isMajorHub ? 1 : 0));
  const unique = Array.from(new Set(matched.map((a) => a.code)));
  return unique.slice(0, 8);
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
 */
// Major international airports with directly integrated mainline/high-speed rail passenger terminals
const INTEGRATED_RAIL_AIRPORT_HUBS = new Set([
  'FRA', 'CDG', 'AMS', 'ZRH', 'BRU', 'DUS', 'LYS', 'LGW', 'LHR', 'FCO', 'VIE', 'BWI', 'HND'
]);

/**
 * Evaluate High-Speed / Mainline Rail connectivity from departure location.
 * Abstract transit model: identifies airports with integrated rail terminal within practical overland rail radius.
 */
export function evaluateHighSpeedRailConnectivity(
  userLat: number,
  userLon: number,
  airportCode: string
): { isConnected: boolean; note?: string } {
  if (!INTEGRATED_RAIL_AIRPORT_HUBS.has(airportCode)) {
    return { isConnected: false };
  }

  const airport = getAirportByIata(airportCode);
  if (!airport) return { isConnected: false };

  const distToAirport = calculateGeodesicDistanceKm(userLat, userLon, airport.lat, airport.lon);

  // Overland rail transit catchment: between 40 km and 460 km
  if (distToAirport <= 460 && distToAirport >= 40) {
    return {
      isConnected: true,
      note: 'Direct intercity / high-speed rail connection to airport terminal',
    };
  }

  return { isConnected: false };
}

/**
 * Suggest optimal departure airports dynamically based on proximity, high-speed rail, and flight corridors.
 */
export function getRecommendedAirportsForCoordinates(
  userLat: number,
  userLon: number,
  maxRadiusKm: number = 380,
  targetDestinations?: string[],
  locale?: string
): DynamicAirport[] {
  const scored: DynamicAirport[] = [];

  // Dynamically evaluate flight corridors from geodesic distance between origin and destinations
  let hasLongHaulDestinations = false;
  let hasMediumHaulDestinations = false;

  if (targetDestinations && targetDestinations.length > 0) {
    for (const d of targetDestinations) {
      const clean = d.trim().toLowerCase();
      const targetAirport =
        getAirportByIata(clean) ||
        indexedAirports.find(
          (a) =>
            a.code.toLowerCase() === clean ||
            a.city.toLowerCase() === clean ||
            clean.includes(a.city.toLowerCase()) ||
            a.name.toLowerCase().includes(clean)
        );

      if (targetAirport) {
        const distKm = calculateGeodesicDistanceKm(userLat, userLon, targetAirport.lat, targetAirport.lon);
        if (distKm >= 3500) {
          hasLongHaulDestinations = true;
        } else if (distKm >= 1500) {
          hasMediumHaulDestinations = true;
        }
      }
    }
  }

  for (const airport of indexedAirports) {
    const distanceKm = calculateGeodesicDistanceKm(userLat, userLon, airport.lat, airport.lon);
    const rail = evaluateHighSpeedRailConnectivity(userLat, userLon, airport.code);

    let corridorNote: string | undefined;
    if (hasLongHaulDestinations && airport.isMajorHub) {
      corridorNote = 'Direct intercontinental long-haul corridor';
    } else if (hasMediumHaulDestinations && (airport.isMajorHub || distanceKm <= 180)) {
      corridorNote = 'Direct holiday charter corridor';
    }

    const localized = locale ? getLocalizedAirportDetails(airport, locale) : airport;

    if (distanceKm <= maxRadiusKm || rail.isConnected) {
      scored.push({
        ...localized,
        distanceKm,
        isHighSpeedRailConnected: rail.isConnected,
        railConnectivityNote: rail.note,
        flightCorridorNote: corridorNote,
      });
    }
  }

  // Split into regional proximity hubs and HSR hubs
  const proximityHubs = scored
    .filter((a) => !a.isHighSpeedRailConnected)
    .sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0));

  const hsrHubs = scored
    .filter((a) => a.isHighSpeedRailConnected)
    .sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0));

  const combined: DynamicAirport[] = [];
  const addedCodes = new Set<string>();

  // Add closest 6 regional proximity hubs
  for (const a of proximityHubs) {
    if (combined.length >= 6) break;
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

  // If long-haul destinations selected, ensure major intercontinental hubs within catchment are prioritized
  if (hasLongHaulDestinations) {
    const intercontinentalHubs = scored.filter((a) => a.isMajorHub);
    for (const hub of intercontinentalHubs) {
      if (!addedCodes.has(hub.code)) {
        combined.push(hub);
        addedCodes.add(hub.code);
      }
    }
  }

  // Return up to 12 recommended departure hubs
  return combined.slice(0, 12);
}

/**
 * Prunes selected airports that fall outside the geodesic catchment area of the new coordinates.
 * Evaluates geodesic distance and any active high-speed rail connectivity.
 * If all selected airports are pruned (or none are within catchment), auto-selects the closest recommended airports.
 */
export function pruneStaleAirportsForCoordinates(
  selectedAirportCodes: string[],
  userLat: number,
  userLon: number,
  maxCatchmentRadiusKm: number = 450,
  targetDestinations?: string[],
  locale?: string
): {
  prunedCodes: string[];
  validCodes: string[];
  recommendedReplacements: DynamicAirport[];
  updatedSelection: string[];
} {
  const validCodes: string[] = [];
  const prunedCodes: string[] = [];

  for (const code of selectedAirportCodes) {
    const airport = getAirportByIata(code);
    if (!airport) {
      prunedCodes.push(code);
      continue;
    }
    const dist = calculateGeodesicDistanceKm(userLat, userLon, airport.lat, airport.lon);
    const rail = evaluateHighSpeedRailConnectivity(userLat, userLon, airport.code);
    if (dist <= maxCatchmentRadiusKm || rail.isConnected) {
      validCodes.push(code);
    } else {
      prunedCodes.push(code);
    }
  }

  const recommendedReplacements = getRecommendedAirportsForCoordinates(
    userLat,
    userLon,
    maxCatchmentRadiusKm,
    targetDestinations,
    locale
  );

  let updatedSelection = validCodes;
  if (validCodes.length === 0 && recommendedReplacements.length > 0) {
    updatedSelection = recommendedReplacements.slice(0, 3).map((a) => a.code);
  }

  return {
    prunedCodes,
    validCodes,
    recommendedReplacements,
    updatedSelection,
  };
}

/**
 * Free-text airport search across 5,600+ airports worldwide
 */
export function searchAirports(
  query: string,
  userCoords?: { lat: number; lon: number },
  limit: number = 10,
  locale?: string
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

  const enriched = matched.map((a) => {
    const localized = locale ? getLocalizedAirportDetails(a, locale) : a;
    if (userCoords) {
      const distanceKm = calculateGeodesicDistanceKm(userCoords.lat, userCoords.lon, a.lat, a.lon);
      const rail = evaluateHighSpeedRailConnectivity(userCoords.lat, userCoords.lon, a.code);
      return {
        ...localized,
        distanceKm,
        isHighSpeedRailConnected: rail.isConnected,
        railConnectivityNote: rail.note,
      };
    }
    return localized;
  });

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
