import { POPULAR_DESTINATIONS } from './weather';
import {
  getAirportByIata,
  getAllCommercialAirports,
  getMajorAirportsForCountry,
} from '../airports/airport-service';

export type DestinationCategory = 'country' | 'region' | 'island' | 'city' | 'airport';

export interface LocalizedDestinationEntity {
  id: string;
  category: DestinationCategory;
  code?: string;
  parentRegionId?: string;
  aliases?: string[];
  airportCodes: string[];
  countryCode: string;
  names: {
    en: string;
    de: string;
    fr: string;
    es: string;
    it: string;
  };
  countryNames: {
    en: string;
    de: string;
    fr: string;
    es: string;
    it: string;
  };
}

/**
 * Backward compatibility export. All place operations are purely dynamic.
 */
export const CANONICAL_DESTINATIONS: LocalizedDestinationEntity[] = [];

/**
 * Normalizes query string for matching
 */
export function normalizeDestinationString(str: string): string {
  return str
    .toLowerCase()
    .replace(/[_\-\/()&]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks if two strings match via full equality or whole-word phrase match
 */
function isWordMatch(source: string, target: string): boolean {
  if (source === target) return true;
  const sWords = source.split(/\s+/);
  const tWords = target.split(/\s+/);

  if (tWords.length > 1 && source.includes(target)) return true;
  if (sWords.length > 1 && target.includes(source)) return true;

  return sWords.includes(target) || tWords.includes(source);
}

/**
 * Calculates Levenshtein edit distance between two strings
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = i;
    for (let j = 1; j <= b.length; j++) {
      const val = a[i - 1] === b[j - 1] ? row[j - 1] : Math.min(row[j - 1], row[j], prev) + 1;
      row[j - 1] = prev;
      prev = val;
    }
    row[b.length] = prev;
  }
  return row[b.length];
}

/**
 * Structured Global Destination Catalog & Multilingual Exonym Directory
 * Provides standardized multilingual metadata, airport cluster mappings, and aliases
 * for major world vacation regions, archipelagos, and international destination cities.
 */
export const GLOBAL_DESTINATION_ENTITIES: LocalizedDestinationEntity[] = [
  // --- Regional Travel Corridors & Archipelagos ---
  {
    id: 'red_sea',
    category: 'region',
    code: 'HRG',
    airportCodes: ['HRG', 'SSH', 'RMF'],
    countryCode: 'EG',
    aliases: [
      'hurghada', 'red sea', 'rotes meer', 'mer rouge', 'mar rojo', 'mar rosso',
      'hurghada rotes meer', 'hurghada & rotes meer', 'hurghada red sea', 'hurghada & red sea'
    ],
    names: {
      en: 'Hurghada & Red Sea',
      de: 'Hurghada & Rotes Meer',
      fr: 'Hurghada et Mer Rouge',
      es: 'Hurgada y Mar Rojo',
      it: 'Hurghada e Mar Rosso',
    },
    countryNames: {
      en: 'Egypt',
      de: 'Ägypten',
      fr: 'Égypte',
      es: 'Egipto',
      it: 'Egitto',
    },
  },
  {
    id: 'mallorca',
    category: 'region',
    code: 'PMI',
    airportCodes: ['PMI'],
    countryCode: 'ES',
    aliases: [
      'mallorca', 'majorca', 'palma', 'palma de mallorca', 'balearen', 'balearic islands',
      'mallorca balearen', 'mallorca balearic', 'mallorca (balearen)', 'majorque', 'maiorca'
    ],
    names: {
      en: 'Mallorca (Balearic Islands)',
      de: 'Mallorca (Balearen)',
      fr: 'Majorque (Îles Baléares)',
      es: 'Mallorca (Islas Baleares)',
      it: 'Maiorca (Isole Baleari)',
    },
    countryNames: {
      en: 'Spain',
      de: 'Spanien',
      fr: 'Espagne',
      es: 'España',
      it: 'Spagna',
    },
  },
  {
    id: 'canary_islands',
    category: 'region',
    code: 'TFS',
    airportCodes: ['TFS', 'LPA', 'ACE', 'FUE'],
    countryCode: 'ES',
    aliases: [
      'canary islands', 'kanarische inseln', 'kanaren', 'canaries', 'iles canaries',
      'islas canarias', 'isole canarie', 'tenerife', 'gran canaria', 'fuerteventura', 'lanzarote'
    ],
    names: {
      en: 'Canary Islands',
      de: 'Kanarische Inseln',
      fr: 'Îles Canaries',
      es: 'Islas Canarias',
      it: 'Isole Canarie',
    },
    countryNames: {
      en: 'Spain',
      de: 'Spanien',
      fr: 'Espagne',
      es: 'España',
      it: 'Spagna',
    },
  },
  {
    id: 'crete',
    category: 'island',
    code: 'HER',
    airportCodes: ['HER', 'CHQ'],
    countryCode: 'GR',
    aliases: ['crete', 'kreta', 'crete island', 'insel kreta', 'crète', 'creta', 'heraklion', 'chania'],
    names: {
      en: 'Crete',
      de: 'Kreta',
      fr: 'Crète',
      es: 'Creta',
      it: 'Creta',
    },
    countryNames: {
      en: 'Greece',
      de: 'Griechenland',
      fr: 'Grèce',
      es: 'Grecia',
      it: 'Grecia',
    },
  },
  {
    id: 'algarve',
    category: 'region',
    code: 'FAO',
    airportCodes: ['FAO'],
    countryCode: 'PT',
    aliases: ['algarve', 'faro', 'algarve coast', 'costa do algarve'],
    names: {
      en: 'Algarve',
      de: 'Algarve',
      fr: 'Algarve',
      es: 'Algarve',
      it: 'Algarve',
    },
    countryNames: {
      en: 'Portugal',
      de: 'Portugal',
      fr: 'Portugal',
      es: 'Portugal',
      it: 'Portogallo',
    },
  },
  {
    id: 'costa_del_sol',
    category: 'region',
    code: 'AGP',
    airportCodes: ['AGP'],
    countryCode: 'ES',
    aliases: ['costa del sol', 'malaga', 'málaga', 'sonnenküste'],
    names: {
      en: 'Costa del Sol (Málaga)',
      de: 'Costa del Sol (Málaga)',
      fr: 'Costa del Sol (Málaga)',
      es: 'Costa del Sol (Málaga)',
      it: 'Costa del Sol (Málaga)',
    },
    countryNames: {
      en: 'Spain',
      de: 'Spanien',
      fr: 'Espagne',
      es: 'España',
      it: 'Spagna',
    },
  },

  // --- Multilingual International Destination Cities & Exonyms ---
  {
    id: 'athens',
    category: 'city',
    code: 'ATH',
    airportCodes: ['ATH'],
    countryCode: 'GR',
    aliases: ['athens', 'athen', 'athènes', 'atenas', 'atene', 'athene', 'aten'],
    names: {
      en: 'Athens',
      de: 'Athen',
      fr: 'Athènes',
      es: 'Atenas',
      it: 'Atene',
    },
    countryNames: {
      en: 'Greece',
      de: 'Griechenland',
      fr: 'Grèce',
      es: 'Grecia',
      it: 'Grecia',
    },
  },
  {
    id: 'munich',
    category: 'city',
    code: 'MUC',
    airportCodes: ['MUC'],
    countryCode: 'DE',
    aliases: ['munich', 'münchen', 'munchen', 'monaco di baviera', 'múnich'],
    names: {
      en: 'Munich',
      de: 'München',
      fr: 'Munich',
      es: 'Múnich',
      it: 'Monaco di Baviera',
    },
    countryNames: {
      en: 'Germany',
      de: 'Deutschland',
      fr: 'Allemagne',
      es: 'Alemania',
      it: 'Germania',
    },
  },
  {
    id: 'rome',
    category: 'city',
    code: 'FCO',
    airportCodes: ['FCO', 'CIA'],
    countryCode: 'IT',
    aliases: ['rome', 'rom', 'roma', 'romme'],
    names: {
      en: 'Rome',
      de: 'Rom',
      fr: 'Rome',
      es: 'Roma',
      it: 'Roma',
    },
    countryNames: {
      en: 'Italy',
      de: 'Italien',
      fr: 'Italie',
      es: 'Italia',
      it: 'Italia',
    },
  },
  {
    id: 'vienna',
    category: 'city',
    code: 'VIE',
    airportCodes: ['VIE'],
    countryCode: 'AT',
    aliases: ['vienna', 'wien', 'vienne', 'viena'],
    names: {
      en: 'Vienna',
      de: 'Wien',
      fr: 'Vienne',
      es: 'Viena',
      it: 'Vienna',
    },
    countryNames: {
      en: 'Austria',
      de: 'Österreich',
      fr: 'Autriche',
      es: 'Austria',
      it: 'Austria',
    },
  },
  {
    id: 'venice',
    category: 'city',
    code: 'VCE',
    airportCodes: ['VCE', 'TSF'],
    countryCode: 'IT',
    aliases: ['venice', 'venedig', 'venise', 'venecia', 'venezia'],
    names: {
      en: 'Venice',
      de: 'Venedig',
      fr: 'Venise',
      es: 'Venecia',
      it: 'Venezia',
    },
    countryNames: {
      en: 'Italy',
      de: 'Italien',
      fr: 'Italie',
      es: 'Italia',
      it: 'Italia',
    },
  },
  {
    id: 'prague',
    category: 'city',
    code: 'PRG',
    airportCodes: ['PRG'],
    countryCode: 'CZ',
    aliases: ['prague', 'prag', 'praha', 'praga'],
    names: {
      en: 'Prague',
      de: 'Prag',
      fr: 'Prague',
      es: 'Praga',
      it: 'Praga',
    },
    countryNames: {
      en: 'Czechia',
      de: 'Tschechien',
      fr: 'Tchéquie',
      es: 'Chequia',
      it: 'Cechia',
    },
  },
  {
    id: 'warsaw',
    category: 'city',
    code: 'WAW',
    airportCodes: ['WAW'],
    countryCode: 'PL',
    aliases: ['warsaw', 'warschau', 'varsovie', 'varsovia', 'varsavia', 'warszawa'],
    names: {
      en: 'Warsaw',
      de: 'Warschau',
      fr: 'Varsovie',
      es: 'Varsovia',
      it: 'Varsavia',
    },
    countryNames: {
      en: 'Poland',
      de: 'Polen',
      fr: 'Pologne',
      es: 'Polonia',
      it: 'Polonia',
    },
  },
  {
    id: 'lisbon',
    category: 'city',
    code: 'LIS',
    airportCodes: ['LIS'],
    countryCode: 'PT',
    aliases: ['lisbon', 'lissabon', 'lisbonne', 'lisboa'],
    names: {
      en: 'Lisbon',
      de: 'Lissabon',
      fr: 'Lisbonne',
      es: 'Lisboa',
      it: 'Lisbona',
    },
    countryNames: {
      en: 'Portugal',
      de: 'Portugal',
      fr: 'Portugal',
      es: 'Portugal',
      it: 'Portogallo',
    },
  },
  {
    id: 'copenhagen',
    category: 'city',
    code: 'CPH',
    airportCodes: ['CPH'],
    countryCode: 'DK',
    aliases: ['copenhagen', 'kopenhagen', 'copenhague', 'copenaghen', 'kobenhavn', 'københavn'],
    names: {
      en: 'Copenhagen',
      de: 'Kopenhagen',
      fr: 'Copenhague',
      es: 'Copenhague',
      it: 'Copenaghen',
    },
    countryNames: {
      en: 'Denmark',
      de: 'Dänemark',
      fr: 'Danemark',
      es: 'Dinamarca',
      it: 'Danimarca',
    },
  },
  {
    id: 'brussels',
    category: 'city',
    code: 'BRU',
    airportCodes: ['BRU', 'CRL'],
    countryCode: 'BE',
    aliases: ['brussels', 'brüssel', 'bruxelles', 'bruselas'],
    names: {
      en: 'Brussels',
      de: 'Brüssel',
      fr: 'Bruxelles',
      es: 'Bruselas',
      it: 'Bruxelles',
    },
    countryNames: {
      en: 'Belgium',
      de: 'Belgien',
      fr: 'Belgique',
      es: 'Bélgica',
      it: 'Belgio',
    },
  },
  {
    id: 'florence',
    category: 'city',
    code: 'FLR',
    airportCodes: ['FLR'],
    countryCode: 'IT',
    aliases: ['florence', 'florenz', 'firenze', 'florencia'],
    names: {
      en: 'Florence',
      de: 'Florenz',
      fr: 'Florence',
      es: 'Florencia',
      it: 'Firenze',
    },
    countryNames: {
      en: 'Italy',
      de: 'Italien',
      fr: 'Italie',
      es: 'Italia',
      it: 'Italia',
    },
  },
  {
    id: 'naples',
    category: 'city',
    code: 'NAP',
    airportCodes: ['NAP'],
    countryCode: 'IT',
    aliases: ['naples', 'neapel', 'napoli', 'nápoles'],
    names: {
      en: 'Naples',
      de: 'Neapel',
      fr: 'Naples',
      es: 'Nápoles',
      it: 'Napoli',
    },
    countryNames: {
      en: 'Italy',
      de: 'Italien',
      fr: 'Italie',
      es: 'Italia',
      it: 'Italia',
    },
  },
  {
    id: 'geneva',
    category: 'city',
    code: 'GVA',
    airportCodes: ['GVA'],
    countryCode: 'CH',
    aliases: ['geneva', 'genf', 'genève', 'ginebra', 'ginevra'],
    names: {
      en: 'Geneva',
      de: 'Genf',
      fr: 'Genève',
      es: 'Ginebra',
      it: 'Ginevra',
    },
    countryNames: {
      en: 'Switzerland',
      de: 'Schweiz',
      fr: 'Suisse',
      es: 'Suiza',
      it: 'Svizzera',
    },
  },
  {
    id: 'zurich',
    category: 'city',
    code: 'ZRH',
    airportCodes: ['ZRH'],
    countryCode: 'CH',
    aliases: ['zurich', 'zürich', 'zurigo'],
    names: {
      en: 'Zurich',
      de: 'Zürich',
      fr: 'Zurich',
      es: 'Zúrich',
      it: 'Zurigo',
    },
    countryNames: {
      en: 'Switzerland',
      de: 'Schweiz',
      fr: 'Suisse',
      es: 'Suiza',
      it: 'Svizzera',
    },
  },
  {
    id: 'milan',
    category: 'city',
    code: 'MXP',
    airportCodes: ['MXP', 'LIN', 'BGY'],
    countryCode: 'IT',
    aliases: ['milan', 'mailand', 'milano', 'milán'],
    names: {
      en: 'Milan',
      de: 'Mailand',
      fr: 'Milan',
      es: 'Milán',
      it: 'Milano',
    },
    countryNames: {
      en: 'Italy',
      de: 'Italien',
      fr: 'Italie',
      es: 'Italia',
      it: 'Italia',
    },
  },
  {
    id: 'seville',
    category: 'city',
    code: 'SVQ',
    airportCodes: ['SVQ'],
    countryCode: 'ES',
    aliases: ['seville', 'sevilla', 'séville', 'siviglia'],
    names: {
      en: 'Seville',
      de: 'Sevilla',
      fr: 'Séville',
      es: 'Sevilla',
      it: 'Siviglia',
    },
    countryNames: {
      en: 'Spain',
      de: 'Spanien',
      fr: 'Espagne',
      es: 'España',
      it: 'Spagna',
    },
  },
  {
    id: 'dubai',
    category: 'city',
    code: 'DXB',
    airportCodes: ['DXB', 'DWC'],
    countryCode: 'AE',
    aliases: ['dubai', 'dubaï', 'dubái'],
    names: {
      en: 'Dubai',
      de: 'Dubai',
      fr: 'Dubaï',
      es: 'Dubái',
      it: 'Dubai',
    },
    countryNames: {
      en: 'United Arab Emirates',
      de: 'Vereinigte Arabische Emirate',
      fr: 'Émirats arabes unis',
      es: 'Emiratos Árabes Unidos',
      it: 'Emirati Arabi Uniti',
    },
  },
  {
    id: 'tokyo',
    category: 'city',
    code: 'HND',
    airportCodes: ['HND', 'NRT'],
    countryCode: 'JP',
    aliases: ['tokyo', 'tokio'],
    names: {
      en: 'Tokyo',
      de: 'Tokio',
      fr: 'Tokyo',
      es: 'Tokio',
      it: 'Tokyo',
    },
    countryNames: {
      en: 'Japan',
      de: 'Japan',
      fr: 'Japon',
      es: 'Japón',
      it: 'Giappone',
    },
  },
  {
    id: 'bangkok',
    category: 'city',
    code: 'BKK',
    airportCodes: ['BKK', 'DMK'],
    countryCode: 'TH',
    aliases: ['bangkok', 'krung thep'],
    names: {
      en: 'Bangkok',
      de: 'Bangkok',
      fr: 'Bangkok',
      es: 'Bangkok',
      it: 'Bangkok',
    },
    countryNames: {
      en: 'Thailand',
      de: 'Thailand',
      fr: 'Thaïlande',
      es: 'Tailandia',
      it: 'Thailandia',
    },
  },
  {
    id: 'bali',
    category: 'island',
    code: 'DPS',
    airportCodes: ['DPS'],
    countryCode: 'ID',
    aliases: ['bali', 'denpasar', 'pulau bali', 'insel bali'],
    names: {
      en: 'Bali (Denpasar)',
      de: 'Bali (Denpasar)',
      fr: 'Bali (Denpasar)',
      es: 'Bali (Denpasar)',
      it: 'Bali (Denpasar)',
    },
    countryNames: {
      en: 'Indonesia',
      de: 'Indonesien',
      fr: 'Indonésie',
      es: 'Indonesia',
      it: 'Indonesia',
    },
  },
  {
    id: 'cancun',
    category: 'city',
    code: 'CUN',
    airportCodes: ['CUN'],
    countryCode: 'MX',
    aliases: ['cancun', 'cancún', 'riviera maya'],
    names: {
      en: 'Cancún',
      de: 'Cancún',
      fr: 'Cancún',
      es: 'Cancún',
      it: 'Cancún',
    },
    countryNames: {
      en: 'Mexico',
      de: 'Mexiko',
      fr: 'Mexique',
      es: 'México',
      it: 'Messico',
    },
  },
];

let dynamicCountryMapCache: Map<string, string> | null = null;

/**
 * Builds a dynamic country name lookup map across standard ISO 3166-1 alpha-2 codes
 * and commercial airport catalogs. Supports all worldwide jurisdictions without static subsets.
 */
function getDynamicCountryNameToCodeMap(): Map<string, string> {
  if (dynamicCountryMapCache) return dynamicCountryMapCache;
  const map = new Map<string, string>();

  // Extract all official country names from airport catalog
  const allAirports = getAllCommercialAirports();
  const rawCountryNames = new Set<string>();
  for (const a of allAirports) {
    if (a.country) rawCountryNames.add(a.country);
  }

  // Populate localized names for all valid 2-letter ISO country codes using ECMAScript Intl
  for (let c1 = 65; c1 <= 90; c1++) {
    for (let c2 = 65; c2 <= 90; c2++) {
      const code = String.fromCharCode(c1, c2);
      for (const loc of ['en', 'de', 'fr', 'es', 'it']) {
        try {
          const name = new Intl.DisplayNames([loc], { type: 'region' }).of(code);
          if (name && name !== code) {
            map.set(normalizeDestinationString(name), code);
          }
        } catch {
          // Unsupported country code
        }
      }
    }
  }

  // Associate English country names from airport database
  for (const rc of rawCountryNames) {
    const cleanRc = normalizeDestinationString(rc);
    if (!map.has(cleanRc)) {
      for (let c1 = 65; c1 <= 90; c1++) {
        for (let c2 = 65; c2 <= 90; c2++) {
          const code = String.fromCharCode(c1, c2);
          try {
            const enName = new Intl.DisplayNames(['en'], { type: 'region' }).of(code);
            if (enName && normalizeDestinationString(enName) === cleanRc) {
              map.set(cleanRc, code);
              break;
            }
          } catch {
            // Ignore
          }
        }
      }
    }
  }

  dynamicCountryMapCache = map;
  return map;
}

/**
 * Resolves any localized country name or English country name to its 2-letter ISO code dynamically.
 */
export function resolveCountryCode(countryNameOrCode: string): string {
  if (!countryNameOrCode) return 'XX';
  const clean = normalizeDestinationString(countryNameOrCode);
  if (clean.length === 2) return clean.toUpperCase();

  const map = getDynamicCountryNameToCodeMap();
  return map.get(clean) || 'XX';
}

/**
 * Convert a commercial airport match into a localized destination entity
 */
function airportToDestinationEntity(
  code: string,
  city: string,
  country: string,
  locale: string = 'en'
): LocalizedDestinationEntity {
  const upper = code.toUpperCase();
  const cCode = resolveCountryCode(country);
  return {
    id: city.toLowerCase().replace(/[^a-z0-9]/g, '_') || upper.toLowerCase(),
    category: 'city',
    code: upper,
    airportCodes: [upper],
    countryCode: cCode,
    names: {
      en: city,
      de: city,
      fr: city,
      es: city,
      it: city,
    },
    countryNames: {
      en: country,
      de: country,
      fr: country,
      es: country,
      it: country,
    },
  };
}

/**
 * Finds a destination entity dynamically by tag or query.
 * Resolves registered multi-airport corridors, direct commercial airports,
 * dynamic ISO countries, or commercial airport passenger cities.
 */
export function getDestinationEntity(
  queryOrTag: string,
  locale: string = 'de'
): LocalizedDestinationEntity | null {
  const clean = normalizeDestinationString(queryOrTag);
  if (!clean || clean.length < 2) return null;

  // 1. Structured global destination registry match
  for (const ent of GLOBAL_DESTINATION_ENTITIES) {
    if (ent.id === clean || ent.code?.toLowerCase() === clean) return ent;
    if (ent.aliases?.some((a) => normalizeDestinationString(a) === clean || isWordMatch(normalizeDestinationString(a), clean))) {
      return ent;
    }
    if (Object.values(ent.names).some((n) => normalizeDestinationString(n) === clean)) {
      return ent;
    }
  }

  const upper = queryOrTag.trim().toUpperCase();

  // 2. Direct IATA commercial airport code
  if (upper.length === 3) {
    const airport = getAirportByIata(upper, locale);
    if (airport) {
      return airportToDestinationEntity(airport.code, airport.city, airport.country, locale);
    }
  }

  // 3. Country match via dynamic ECMAScript Intl
  const countryCode = resolveCountryCode(clean);
  if (countryCode && countryCode !== 'XX') {
    const getIntl = (l: string) => new Intl.DisplayNames([l], { type: 'region' });
    const cNames = {
      en: getIntl('en').of(countryCode) || countryCode,
      de: getIntl('de').of(countryCode) || countryCode,
      fr: getIntl('fr').of(countryCode) || countryCode,
      es: getIntl('es').of(countryCode) || countryCode,
      it: getIntl('it').of(countryCode) || countryCode,
    };
    return {
      id: countryCode.toLowerCase(),
      category: 'country',
      airportCodes: getMajorAirportsForCountry(countryCode),
      countryCode,
      names: cNames,
      countryNames: cNames,
    };
  }

  // 4. Commercial airport city matching across all 7,184 worldwide airports
  const allAirports = getAllCommercialAirports();
  const candidates = [];
  for (const a of allAirports) {
    const aCity = normalizeDestinationString(a.city);
    const aName = normalizeDestinationString(a.name);
    if (aCity === clean || aName === clean || isWordMatch(aCity, clean) || isWordMatch(aName, clean)) {
      candidates.push(a);
    }
  }

  candidates.sort((a, b) => {
    const aExact = normalizeDestinationString(a.city) === clean ? 1 : 0;
    const bExact = normalizeDestinationString(b.city) === clean ? 1 : 0;
    if (aExact !== bExact) return bExact - aExact;
    const aHub = a.isMajorHub ? 1 : 0;
    const bHub = b.isMajorHub ? 1 : 0;
    return bHub - aHub;
  });

  if (candidates.length > 0) {
    const best = candidates[0];
    return airportToDestinationEntity(best.code, best.city, best.country, locale);
  }

  return null;
}

/**
 * Resilient fuzzy matching across destinations and commercial airport cities worldwide.
 */
export function fuzzyMatchDestinationEntity(
  query: string,
  locale: string = 'de'
): LocalizedDestinationEntity | null {
  const clean = normalizeDestinationString(query);
  if (!clean || clean.length < 3) return null;

  // Direct entity match first
  const direct = getDestinationEntity(query, locale);
  if (direct) return direct;

  // 1. Resilient fuzzy match against global destination entities & aliases
  let bestEntity: LocalizedDestinationEntity | null = null;
  let minEntityDist = Infinity;

  for (const ent of GLOBAL_DESTINATION_ENTITIES) {
    const candidateStrings = [
      ent.id,
      ent.code?.toLowerCase(),
      ...(ent.aliases || []),
      ...Object.values(ent.names),
    ].filter(Boolean) as string[];

    for (const cand of candidateStrings) {
      const normCand = normalizeDestinationString(cand);
      const dist = levenshteinDistance(clean, normCand);
      const maxAllowed = clean.length <= 4 ? 1 : 2;
      if (dist <= maxAllowed && dist < minEntityDist) {
        minEntityDist = dist;
        bestEntity = ent;
      }
    }
  }

  if (bestEntity && minEntityDist <= 2) {
    return bestEntity;
  }

  // 2. Resilient fuzzy match against all commercial airport cities and names
  const allAirports = getAllCommercialAirports();
  let bestAirportMatch: LocalizedDestinationEntity | null = null;
  let minDistance = Infinity;

  for (const a of allAirports) {
    const candidates = [normalizeDestinationString(a.city), normalizeDestinationString(a.name)];
    for (const cand of candidates) {
      if (!cand || cand.length < 3) continue;
      const dist = levenshteinDistance(clean, cand);
      const maxAllowed = clean.length <= 4 ? 1 : 2;

      if (dist <= maxAllowed && dist < minDistance) {
        minDistance = dist;
        bestAirportMatch = airportToDestinationEntity(a.code, a.city, a.country, locale);
      }
    }
  }

  return bestAirportMatch;
}

export interface ContainmentCheckResult {
  isContained: boolean;
  parentTag?: string;
  parentEntity?: LocalizedDestinationEntity;
  childEntity?: LocalizedDestinationEntity;
}

/**
 * Detects if a candidate destination entity is already encompassed by an active parent destination.
 * e.g. "Palma" when "Mallorca" is already active, or "Hurghada City" when "Red Sea" is active.
 */
export function checkRegionalContainment(
  candidateInputOrEntity: string | LocalizedDestinationEntity,
  selectedDestinations: string[],
  locale: string = 'de'
): ContainmentCheckResult {
  const child = typeof candidateInputOrEntity === 'string'
    ? getDestinationEntity(candidateInputOrEntity, locale)
    : candidateInputOrEntity;

  if (!child || !selectedDestinations || selectedDestinations.length === 0) {
    return { isContained: false };
  }

  const cleanChildId = normalizeDestinationString(child.id);

  for (const existingTag of selectedDestinations) {
    const cleanParentTag = normalizeDestinationString(existingTag);
    if (cleanParentTag === cleanChildId) continue;

    const parent = getDestinationEntity(existingTag, locale);

    // 1. Explicit parent region match
    if (child.parentRegionId && (cleanParentTag.includes(child.parentRegionId) || parent?.id === child.parentRegionId)) {
      return {
        isContained: true,
        parentTag: existingTag,
        parentEntity: parent || undefined,
        childEntity: child,
      };
    }

    // 2. Airport codes containment: If all airport codes of child are encompassed by parent
    if (parent && parent.airportCodes.length > 0 && child.airportCodes.length > 0) {
      if (child.airportCodes.every((code) => parent.airportCodes.includes(code))) {
        return {
          isContained: true,
          parentTag: existingTag,
          parentEntity: parent,
          childEntity: child,
        };
      }
    }

    // 3. Country-level containment
    if (parent && parent.category === 'country' && child.countryCode && parent.countryCode) {
      if (child.countryCode === parent.countryCode) {
        return {
          isContained: true,
          parentTag: existingTag,
          parentEntity: parent,
          childEntity: child,
        };
      }
    }

    // 4. Substring / phrase containment: e.g. "Palma" in "Mallorca (Balearen)" or "Hurghada" in "Hurghada & Rotes Meer"
    if (
      cleanParentTag.includes(cleanChildId) ||
      cleanChildId.includes(cleanParentTag) ||
      (child.names && Object.values(child.names).some((n) => cleanParentTag.includes(normalizeDestinationString(n))))
    ) {
      return {
        isContained: true,
        parentTag: existingTag,
        parentEntity: parent || undefined,
        childEntity: child,
      };
    }
  }

  return { isContained: false };
}

/**
 * Returns localized name for destination entity
 */
export function getLocalizedDestinationName(
  entity: LocalizedDestinationEntity,
  locale: string = 'de'
): string {
  const l = (locale.slice(0, 2) as keyof typeof entity.names) || 'de';
  return entity.names[l] || entity.names.en || entity.names.de;
}

/**
 * Returns localized category name for entity
 */
export function getLocalizedCategoryName(
  category: DestinationCategory,
  locale: string = 'de'
): string {
  const l = locale.slice(0, 2);
  const map: Record<string, Record<DestinationCategory, string>> = {
    de: { country: 'Land', region: 'Region', island: 'Insel', city: 'Stadt', airport: 'Flughafen' },
    en: { country: 'Country', region: 'Region', island: 'Island', city: 'City', airport: 'Airport' },
    fr: { country: 'Pays', region: 'Région', island: 'Île', city: 'Ville', airport: 'Aéroport' },
    es: { country: 'País', region: 'Región', island: 'Isla', city: 'Ciudad', airport: 'Aeropuerto' },
    it: { country: 'Paese', region: 'Regione', island: 'Isola', city: 'Città', airport: 'Aeroporto' },
  };

  const set = map[l] || map.de;
  return set[category] || category;
}

/**
 * Resolves user destination tags into valid candidate destination airport codes.
 * Dynamically queries commercial passenger airport catalogs and runtime country indices.
 * STRICT: If destination tags are provided, returns ONLY the matching airports.
 */
export function resolveDestinationCodes(destinationTags?: string[]): string[] {
  // If no destination filter was set by user, provide open discovery hubs dynamically
  if (!destinationTags || destinationTags.length === 0) {
    const commercialAirports = getAllCommercialAirports();
    const hubs = commercialAirports.filter((a) => a.isMajorHub);
    const popularLeisure = ['PMI', 'AYT', 'HRG', 'HER', 'AGP', 'FAO', 'BCN', 'DJE'];
    const codes = Array.from(new Set([...popularLeisure, ...hubs.map((a) => a.code)]));
    return codes.slice(0, 10);
  }

  const resolved = new Set<string>();

  for (const tag of destinationTags) {
    const clean = normalizeDestinationString(tag);
    if (!clean) continue;

    // 1. Destination entity (region, island, or city)
    const entity = getDestinationEntity(tag);
    if (entity && entity.airportCodes.length > 0) {
      entity.airportCodes.forEach((c) => resolved.add(c));
      continue;
    }

    // 2. Direct 3-letter IATA code
    const upper = tag.trim().toUpperCase();
    if (upper.length === 3 && (POPULAR_DESTINATIONS[upper] || getAirportByIata(upper))) {
      resolved.add(upper);
      continue;
    }

    // 3. Direct commercial airport matching from airport-data
    const allAirports = getAllCommercialAirports();
    let matchedAirport = false;
    for (const a of allAirports) {
      const aCity = normalizeDestinationString(a.city);
      const aName = normalizeDestinationString(a.name);
      if (aCity === clean || aName === clean || isWordMatch(aCity, clean)) {
        resolved.add(a.code);
        matchedAirport = true;
      }
    }
    if (matchedAirport) continue;

    // 4. Country-level major airport hubs
    const countryAirports = getMajorAirportsForCountry(clean);
    if (countryAirports.length > 0) {
      countryAirports.forEach((code) => resolved.add(code));
    }
  }

  return Array.from(resolved);
}

/**
 * Strict pre-validation for destination inputs with regional containment detection.
 * Validates dynamically against live geocoding services and commercial airport indices.
 * Rejects fictitious or unserviceable inputs that cannot be mapped to any airport or recognized entity.
 */
export async function validateDestinationInput(
  rawInput: string,
  locale: string = 'de',
  selectedDestinations: string[] = []
): Promise<{
  isValid: boolean;
  entity?: LocalizedDestinationEntity;
  resolvedName?: string;
  category?: DestinationCategory;
  categoryLabel?: string;
  airportCodes?: string[];
  isContained?: boolean;
  containment?: ContainmentCheckResult;
}> {
  const clean = rawInput.trim();
  if (!clean || clean.length < 2) {
    return { isValid: false };
  }

  // 1. Destination entity match (regions, islands, cities, exonyms)
  const entity = getDestinationEntity(clean, locale);
  if (entity) {
    const localizedName = getLocalizedDestinationName(entity, locale);
    const containment = checkRegionalContainment(entity, selectedDestinations, locale);
    return {
      isValid: true,
      entity,
      resolvedName: localizedName,
      category: entity.category,
      categoryLabel: getLocalizedCategoryName(entity.category, locale),
      airportCodes: entity.airportCodes,
      isContained: containment.isContained,
      containment,
    };
  }

  // 2. Check direct commercial airport IATA code
  const upper = clean.toUpperCase();
  if (upper.length === 3) {
    const airport = getAirportByIata(upper, locale);
    if (airport) {
      const containment = checkRegionalContainment(upper, selectedDestinations, locale);
      return {
        isValid: true,
        resolvedName: `${airport.name} (${upper})`,
        category: 'airport',
        categoryLabel: getLocalizedCategoryName('airport', locale),
        airportCodes: [upper],
        isContained: containment.isContained,
        containment,
      };
    }
  }

  // 3. Dynamic lookup via searchGlobalPlaces (runtime geocoding + airport proximity)
  try {
    const { searchGlobalPlaces } = await import('../geo/places');
    const places = await searchGlobalPlaces(clean, locale, 3);
    if (places && places.length > 0) {
      const place = places[0];
      if (place.airportCodes && place.airportCodes.length > 0) {
        const locKey = ((locale.slice(0, 2) as 'en' | 'de' | 'fr' | 'es' | 'it') || 'en');
        const localizedName = place.names?.[locKey] || place.name;

        const resolvedEntity: LocalizedDestinationEntity = {
          id: place.id,
          category: place.category as DestinationCategory,
          code: place.airportCodes[0],
          parentRegionId: place.parentRegionId,
          aliases: place.aliases,
          airportCodes: place.airportCodes,
          countryCode: place.countryCode,
          names: place.names,
          countryNames: {
            en: place.countryName,
            de: place.countryName,
            fr: place.countryName,
            es: place.countryName,
            it: place.countryName,
          },
        };

        const containment = checkRegionalContainment(resolvedEntity, selectedDestinations, locale);

        return {
          isValid: true,
          entity: resolvedEntity,
          resolvedName: localizedName,
          category: place.category as DestinationCategory,
          categoryLabel: getLocalizedCategoryName(place.category as DestinationCategory, locale),
          airportCodes: place.airportCodes,
          isContained: containment.isContained,
          containment,
        };
      }
    }
  } catch {
    // Fall through
  }

  // 4. Strict rejection for unknown, non-flight, or fictitious places
  return { isValid: false };
}

