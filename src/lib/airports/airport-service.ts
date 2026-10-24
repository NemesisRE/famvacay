import airportsData from './data/airports.json';
import airportTrafficData from './data/airport-traffic.json';
import { getLocalizedCityName } from './localized-city-names';
import { derived, getDataset } from '@/lib/datasets/store';

export interface DynamicAirport {
  code: string;       // 3-letter IATA code
  icao: string;       // 4-letter ICAO code
  name: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
  altitude?: number;  // Elevation in feet above sea level
  type?: string;      // 'large_airport' | 'medium_airport' | 'small_airport'
  state?: string;     // Administrative subdivision (e.g. DE-BW, FR-IDF, AT-9)
  distanceKm?: number;
  isHighSpeedRailConnected?: boolean;
  railConnectivityNote?: string;
  flightCorridorNote?: string;
  isMajorHub?: boolean;
  keywords?: string;
}

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
> = {
  VIE: { city: { de: 'Wien', en: 'Vienna', fr: 'Vienne', es: 'Viena', it: 'Vienna' } },
  SZG: { city: { de: 'Salzburg', en: 'Salzburg', fr: 'Salzbourg', es: 'Salzburgo', it: 'Salisburgo' } },
  GVA: { city: { de: 'Genf', en: 'Geneva', fr: 'Genève', es: 'Ginebra', it: 'Ginevra' } },
  ZRH: { city: { de: 'Zürich', en: 'Zurich', fr: 'Zurich', es: 'Zúrich', it: 'Zurigo' } },
  MUC: { city: { de: 'München', en: 'Munich', fr: 'Munich', es: 'Múnich', it: 'Monaco di Baviera' } },
  FCO: { city: { de: 'Rom', en: 'Rome', fr: 'Rome', es: 'Roma', it: 'Roma' } },
  ATH: { city: { de: 'Athen', en: 'Athens', fr: 'Athènes', es: 'Atenas', it: 'Atene' } },
  PRG: { city: { de: 'Prag', en: 'Prague', fr: 'Prague', es: 'Praga', it: 'Praga' } },
  LIS: { city: { de: 'Lissabon', en: 'Lisbon', fr: 'Lisbonne', es: 'Lisboa', it: 'Lisbona' } },
  DXB: { city: { de: 'Dubai', en: 'Dubai', fr: 'Dubaï', es: 'Dubái', it: 'Dubai' } },
  PMI: { city: { de: 'Palma de Mallorca', en: 'Palma de Mallorca', fr: 'Palma de Majorque', es: 'Palma de Mallorca', it: 'Palma di Maiorca' } },
  TFS: { city: { de: 'Teneriffa', en: 'Tenerife', fr: 'Ténérife', es: 'Tenerife', it: 'Tenerife' } },
  LPA: { city: { de: 'Gran Canaria', en: 'Gran Canaria', fr: 'Grande Canarie', es: 'Gran Canaria', it: 'Gran Canaria' } },
  HER: { city: { de: 'Heraklion (Kreta)', en: 'Heraklion (Crete)', fr: 'Héraklion (Crète)', es: 'Heraclión (Creta)', it: 'Candia (Creta)' } },
  FNC: { city: { de: 'Funchal (Madeira)', en: 'Funchal (Madeira)', fr: 'Funchal (Madère)', es: 'Funchal (Madeira)', it: 'Funchal (Madeira)' } },
  CDG: { city: { de: 'Paris', en: 'Paris', fr: 'Paris', es: 'París', it: 'Parigi' } },
  LHR: { city: { de: 'London', en: 'London', fr: 'Londres', es: 'Londres', it: 'Londra' } },
  KEF: { city: { de: 'Reykjavik', en: 'Reykjavik', fr: 'Reykjavik', es: 'Reikiavik', it: 'Reykjavik' } },
  BZO: { city: { de: 'Bozen (Südtirol)', en: 'Bolzano (South Tyrol)', fr: 'Bolzano (Tyrol du Sud)', es: 'Bolzano', it: 'Bolzano' } },
};

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
  const exonym = getLocalizedCityName(airport.code, loc);
  if (!meta) {
    return {
      ...airport,
      city: exonym || airport.city,
      country: localizedCountry,
    };
  }

  return {
    ...airport,
    name: meta.name?.[loc] || meta.name?.en || airport.name,
    city: meta.city?.[loc] || exonym || meta.city?.en || airport.city,
    state: meta.state || airport.state,
    isMajorHub: meta.isMajorHub ?? airport.isMajorHub,
    country: localizedCountry,
  };
}

/**
 * Backward compatibility stubs. All exclusions and non-commercial classifications
 * are pre-filtered in the open dataset and Prisma models.
 */
export const EXCLUDED_NON_COMMERCIAL_AIRPORTS = new Set<string>();
export const NON_COMMERCIAL_KEYWORDS: string[] = [];

// Index active commercial passenger airports worldwide (rebuilt when a refreshed dataset lands)
const airportIndex = derived(() => {
  const list: DynamicAirport[] = getDataset('airports', airportsData as DynamicAirport[]).map((a) => {
    const meta = LOCALIZED_AIRPORT_METADATA[a.code];
    return {
      code: a.code,
      icao: a.icao || '',
      name: meta?.name?.en || a.name || '',
      city: meta?.city?.en || a.city || '',
      country: a.country || '',
      lat: Number(a.lat),
      lon: Number(a.lon),
      altitude: Number(a.altitude) || 0,
      type: a.type || undefined,
      state: meta?.state || a.state || undefined,
      isMajorHub: meta?.isMajorHub ?? Boolean(a.isMajorHub),
      isHighSpeedRailConnected: Boolean(a.isHighSpeedRailConnected),
      keywords: (a as any).keywords || undefined,
    };
  });
  const byIata = new Map<string, DynamicAirport>();
  for (const a of list) byIata.set(a.code, a);
  return { list, byIata };
});

export function isCommercialPassengerAirport(airport: {
  iata?: string;
  code?: string;
  name?: string;
  city?: string;
  isMajorHub?: boolean;
}): boolean {
  const code = (airport.code || airport.iata || '').toUpperCase();
  if (!code || code.length !== 3 || code === '\\N') {
    return false;
  }
  return airportIndex().byIata.has(code);
}

/**
 * Retrieve airport details by IATA code
 */
export function getAirportByIata(code: string, locale?: string): DynamicAirport | undefined {
  if (!code) return undefined;
  const ap = airportIndex().byIata.get(code.toUpperCase());
  if (!ap) return undefined;
  return locale ? getLocalizedAirportDetails(ap, locale) : ap;
}

/**
 * Returns all indexed commercial passenger airports
 */
export function getAllCommercialAirports(): DynamicAirport[] {
  return airportIndex().list;
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

  const matched = airportIndex().list.filter((a) => {
    const c = a.country.toLowerCase();
    const st = (a.state || '').toLowerCase();
    return c === targetCountryName || (clean.length === 2 && st.startsWith(clean.toLowerCase() + '-'));
  });

  // Prioritize high-speed rail connected hubs and major international gateways
  matched.sort((a, b) => {
    if (a.isHighSpeedRailConnected && !b.isHighSpeedRailConnected) return -1;
    if (!a.isHighSpeedRailConnected && b.isHighSpeedRailConnected) return 1;
    if (a.isMajorHub && !b.isMajorHub) return -1;
    if (!a.isMajorHub && b.isMajorHub) return 1;
    return a.code.localeCompare(b.code);
  });
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
  // Same spherical law of cosines, earth radius and 1 m rounding as geolib's getDistance,
  // inlined because this is the optimizer's hottest primitive (geolib re-parses each
  // coordinate object on every call).
  const toRad = Math.PI / 180;
  const cosArg =
    Math.sin(lat2 * toRad) * Math.sin(lat1 * toRad) +
    Math.cos(lat2 * toRad) * Math.cos(lat1 * toRad) * Math.cos((lon1 - lon2) * toRad);
  const meters = Math.round(Math.acos(Math.max(-1, Math.min(1, cosArg))) * EARTH_RADIUS_METERS);
  return Math.round(meters / 1000);
}

const EARTH_RADIUS_METERS = 6378137;

/**
 * Evaluate High-Speed / Mainline Rail connectivity from departure location.
 * Abstract transit model: identifies airports with integrated rail terminal within practical overland rail radius.
 */
export function evaluateHighSpeedRailConnectivity(
  userLat: number,
  userLon: number,
  airportCode: string
): { isConnected: boolean; note?: string } {
  const airport = getAirportByIata(airportCode);
  if (!airport || !airport.isHighSpeedRailConnected) {
    return { isConnected: false };
  }

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
        airportIndex().list.find(
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

  for (const airport of airportIndex().list) {
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

  const matched = airportIndex().list.filter((a) => {
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

/**
 * Peak annual passengers in millions (Wikidata P3872, see
 * src/lib/datasets/generators/airport-traffic.ts), or undefined when no figure is recorded.
 */
export function getAirportPassengersMillions(code: string): number | undefined {
  return getDataset('airport-traffic', airportTrafficData as Record<string, number>)[(code || '').toUpperCase()];
}
