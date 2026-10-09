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

export const LOCALIZED_AIRPORT_METADATA: Record<
  string,
  {
    name: Record<string, string>;
    city: Record<string, string>;
    state: string;
    isMajorHub: boolean;
  }
> = {
  BSL: {
    name: {
      de: 'EuroAirport Basel-Mulhouse-Freiburg (Basel-Mülhausen)',
      en: 'EuroAirport Basel-Mulhouse-Freiburg',
      fr: 'EuroAirport Bâle-Mulhouse-Fribourg',
      es: 'EuroAirport Basilea-Mulhouse-Friburgo',
      it: 'EuroAirport Basilea-Mulhouse-Friburgo',
    },
    city: {
      de: 'Basel / Mülhausen / Freiburg',
      en: 'Basel / Mulhouse / Freiburg',
      fr: 'Bâle / Mulhouse',
      es: 'Basilea / Mulhouse',
      it: 'Basilea / Mulhouse',
    },
    state: 'CH-BS',
    isMajorHub: true,
  },
  FRA: {
    name: {
      de: 'Flughafen Frankfurt am Main',
      en: 'Frankfurt am Main Airport',
      fr: 'Aéroport de Francfort-sur-le-Main',
      es: 'Aeropuerto de Fráncfort del Meno',
      it: 'Aeroporto di Francoforte sul Meno',
    },
    city: {
      de: 'Frankfurt am Main',
      en: 'Frankfurt',
      fr: 'Francfort',
      es: 'Fráncfort',
      it: 'Francoforte',
    },
    state: 'DE-HE',
    isMajorHub: true,
  },
  MUC: {
    name: {
      de: 'Flughafen München Franz Josef Strauß',
      en: 'Munich Airport',
      fr: 'Aéroport de Munich',
      es: 'Aeropuerto de Múnich',
      it: 'Aeroporto di Monaco di Baviera',
    },
    city: {
      de: 'München',
      en: 'Munich',
      fr: 'Munich',
      es: 'Múnich',
      it: 'Monaco',
    },
    state: 'DE-BY',
    isMajorHub: true,
  },
  STR: {
    name: {
      de: 'Flughafen Stuttgart Manfred Rommel',
      en: 'Stuttgart Airport',
      fr: 'Aéroport de Stuttgart',
      es: 'Aeropuerto de Stuttgart',
      it: 'Aeroporto di Stoccarda',
    },
    city: {
      de: 'Stuttgart',
      en: 'Stuttgart',
      fr: 'Stuttgart',
      es: 'Stuttgart',
      it: 'Stoccarda',
    },
    state: 'DE-BW',
    isMajorHub: true,
  },
  FKB: {
    name: {
      de: 'Flughafen Karlsruhe/Baden-Baden (Baden-Airpark)',
      en: 'Karlsruhe/Baden-Baden Airport (Baden-Airpark)',
      fr: 'Aéroport de Karlsruhe/Baden-Baden',
      es: 'Aeropuerto de Karlsruhe/Baden-Baden',
      it: 'Aeroporto di Karlsruhe/Baden-Baden',
    },
    city: {
      de: 'Karlsruhe / Baden-Baden',
      en: 'Karlsruhe / Baden-Baden',
      fr: 'Karlsruhe / Baden-Baden',
      es: 'Karlsruhe / Baden-Baden',
      it: 'Karlsruhe / Baden-Baden',
    },
    state: 'DE-BW',
    isMajorHub: true,
  },
  BER: {
    name: {
      de: 'Flughafen Berlin Brandenburg Willy Brandt',
      en: 'Berlin Brandenburg Airport',
      fr: 'Aéroport de Berlin-Brandebourg',
      es: 'Aeropuerto de Berlín-Brandeburgo',
      it: 'Aeroporto di Berlino-Brandeburgo',
    },
    city: {
      de: 'Berlin',
      en: 'Berlin',
      fr: 'Berlin',
      es: 'Berlín',
      it: 'Berlino',
    },
    state: 'DE-BE',
    isMajorHub: true,
  },
  HAM: {
    name: {
      de: 'Flughafen Hamburg Helmut Schmidt',
      en: 'Hamburg Airport',
      fr: 'Aéroport de Hambourg',
      es: 'Aeropuerto de Hamburgo',
      it: 'Aeroporto di Amburgo',
    },
    city: {
      de: 'Hamburg',
      en: 'Hamburg',
      fr: 'Hambourg',
      es: 'Hamburgo',
      it: 'Amburgo',
    },
    state: 'DE-HH',
    isMajorHub: true,
  },
  DUS: {
    name: {
      de: 'Flughafen Düsseldorf',
      en: 'Düsseldorf Airport',
      fr: 'Aéroport de Düsseldorf',
      es: 'Aeropuerto de Düsseldorf',
      it: 'Aeroporto di Düsseldorf',
    },
    city: {
      de: 'Düsseldorf',
      en: 'Düsseldorf',
      fr: 'Düsseldorf',
      es: 'Düsseldorf',
      it: 'Düsseldorf',
    },
    state: 'DE-NW',
    isMajorHub: true,
  },
  CGN: {
    name: {
      de: 'Flughafen Köln/Bonn Konrad Adenauer',
      en: 'Cologne Bonn Airport',
      fr: 'Aéroport de Cologne-Bonn',
      es: 'Aeropuerto de Colonia/Bonn',
      it: 'Aeroporto di Colonia-Bonn',
    },
    city: {
      de: 'Köln / Bonn',
      en: 'Cologne / Bonn',
      fr: 'Cologne / Bonn',
      es: 'Colonia / Bonn',
      it: 'Colonia / Bonn',
    },
    state: 'DE-NW',
    isMajorHub: true,
  },
  CDG: {
    name: {
      de: 'Flughafen Paris-Charles-de-Gaulle',
      en: 'Paris Charles de Gaulle Airport',
      fr: 'Aéroport de Paris-Charles-de-Gaulle',
      es: 'Aeropuerto de París-Charles de Gaulle',
      it: 'Aeroporto di Parigi Charles de Gaulle',
    },
    city: {
      de: 'Paris',
      en: 'Paris',
      fr: 'Paris',
      es: 'París',
      it: 'Parigi',
    },
    state: 'FR-IDF',
    isMajorHub: true,
  },
  ORY: {
    name: {
      de: 'Flughafen Paris-Orly',
      en: 'Paris Orly Airport',
      fr: 'Aéroport de Paris-Orly',
      es: 'Aeropuerto de París-Orly',
      it: 'Aeroporto di Parigi Orly',
    },
    city: {
      de: 'Paris',
      en: 'Paris',
      fr: 'Paris',
      es: 'París',
      it: 'Parigi',
    },
    state: 'FR-IDF',
    isMajorHub: true,
  },
  SXB: {
    name: {
      de: 'Flughafen Straßburg Entzheim',
      en: 'Strasbourg Airport',
      fr: 'Aéroport de Strasbourg-Entzheim',
      es: 'Aeropuerto de Estrasburgo',
      it: 'Aeroporto di Strasburgo',
    },
    city: {
      de: 'Straßburg',
      en: 'Strasbourg',
      fr: 'Strasbourg',
      es: 'Estrasburgo',
      it: 'Strasburgo',
    },
    state: 'FR-GES',
    isMajorHub: true,
  },
  ZRH: {
    name: {
      de: 'Flughafen Zürich Kloten',
      en: 'Zurich Airport',
      fr: 'Aéroport de Zurich',
      es: 'Aeropuerto de Zúrich',
      it: 'Aeroporto di Zurigo',
    },
    city: {
      de: 'Zürich',
      en: 'Zurich',
      fr: 'Zurich',
      es: 'Zúrich',
      it: 'Zurigo',
    },
    state: 'CH-ZH',
    isMajorHub: true,
  },
  VIE: {
    name: {
      de: 'Flughafen Wien-Schwechat',
      en: 'Vienna International Airport',
      fr: 'Aéroport de Vienne-Schwechat',
      es: 'Aeropuerto de Viena-Schwechat',
      it: 'Aeroporto di Vienna-Schwechat',
    },
    city: {
      de: 'Wien',
      en: 'Vienna',
      fr: 'Vienne',
      es: 'Viena',
      it: 'Vienna',
    },
    state: 'AT-9',
    isMajorHub: true,
  },
};

export function getLocalizedAirportDetails(airport: DynamicAirport, locale: string = 'en'): DynamicAirport {
  const meta = LOCALIZED_AIRPORT_METADATA[airport.code];
  if (!meta) return airport;
  const loc = (locale || 'en').toLowerCase().slice(0, 2);
  return {
    ...airport,
    name: meta.name[loc] || meta.name.en || airport.name,
    city: meta.city[loc] || meta.city.en || airport.city,
    state: meta.state || airport.state,
    isMajorHub: meta.isMajorHub ?? airport.isMajorHub,
  };
}

// Index valid commercial IATA airports
const indexedAirports: DynamicAirport[] = rawAirports
  .filter((a) => a.iata && a.iata.length === 3 && a.iata !== '\\N')
  .map((a) => {
    const code = a.iata.toUpperCase();
    const meta = LOCALIZED_AIRPORT_METADATA[code];
    return {
      code,
      icao: a.icao || '',
      name: meta?.name.en || a.name || '',
      city: meta?.city.en || a.city || '',
      country: a.country || '',
      lat: Number(a.latitude),
      lon: Number(a.longitude),
      state: meta?.state || AIRPORT_STATE_MAPPING[code] || (a.country === 'Germany' ? 'DE-BW' : undefined),
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
function evaluateHighSpeedRailConnectivity(
  userLat: number,
  userLon: number,
  airportCode: string
): { isConnected: boolean; note?: string } {
  // Paris Hubs (CDG, ORY)
  if (airportCode === 'CDG' || airportCode === 'ORY') {
    const isSwGermanyOrRhine =
      userLat >= 47.4 && userLat <= 50.5 && userLon >= 6.0 && userLon <= 9.5;
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
    const distToBrussels = calculateGeodesicDistanceKm(userLat, userLon, 50.8503, 4.3517);
    if (distToBrussels <= 280) {
      return {
        isConnected: true,
        note: 'Direct Eurostar / ICE service (<2h)',
      };
    }
  }

  // Frankfurt Airport (FRA) AIRail
  if (airportCode === 'FRA') {
    const distToFrankfurt = calculateGeodesicDistanceKm(userLat, userLon, 50.0379, 8.5622);
    if (distToFrankfurt <= 200) {
      return {
        isConnected: true,
        note: 'Direct ICE AIRail straight to airport terminal (<1h)',
      };
    }
  }

  // Amsterdam Hub (AMS) for Lower Rhine / Ruhr area
  if (airportCode === 'AMS') {
    const distToAms = calculateGeodesicDistanceKm(userLat, userLon, 52.3105, 4.7683);
    if (distToAms <= 260) {
      return {
        isConnected: true,
        note: 'Direct ICE connection (<2.5h)',
      };
    }
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

  // Check destination corridors
  const destListLower = (targetDestinations || []).map((d) => d.toLowerCase());
  const hasLongHaulDestinations = destListLower.some(
    (d) =>
      d.includes('bali') ||
      d.includes('cancun') ||
      d.includes('thailand') ||
      d.includes('phuket') ||
      d.includes('dubai') ||
      d.includes('egypt') ||
      d.includes('caribbean') ||
      d.includes('dps') ||
      d.includes('cun') ||
      d.includes('dxb') ||
      d.includes('hkt')
  );

  const hasEgyptOrTurkey = destListLower.some(
    (d) =>
      d.includes('egypt') ||
      d.includes('hurghada') ||
      d.includes('sharm') ||
      d.includes('turkey') ||
      d.includes('riviera') ||
      d.includes('antalya') ||
      d.includes('hrg') ||
      d.includes('ayt')
  );

  for (const airport of indexedAirports) {
    if (!airport.isMajorHub && airport.country !== 'Germany' && airport.country !== 'France' && airport.country !== 'Switzerland' && airport.country !== 'Austria') {
      continue;
    }

    const distanceKm = calculateGeodesicDistanceKm(userLat, userLon, airport.lat, airport.lon);
    const rail = evaluateHighSpeedRailConnectivity(userLat, userLon, airport.code);

    let corridorNote: string | undefined;
    if (hasLongHaulDestinations && (airport.code === 'FRA' || airport.code === 'CDG' || airport.code === 'MUC')) {
      corridorNote = 'Direct intercontinental long-haul corridor';
    } else if (hasEgyptOrTurkey && ['STR', 'FKB', 'BSL', 'DUS', 'FRA', 'MUC', 'NUE'].includes(airport.code)) {
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

  // Add closest 7 regional proximity hubs
  for (const a of proximityHubs) {
    if (combined.length >= 7) break;
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
