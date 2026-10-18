import countries from 'i18n-iso-countries';
import deCountries from 'i18n-iso-countries/langs/de.json';
import enCountries from 'i18n-iso-countries/langs/en.json';
import frCountries from 'i18n-iso-countries/langs/fr.json';
import esCountries from 'i18n-iso-countries/langs/es.json';
import itCountries from 'i18n-iso-countries/langs/it.json';
import iso from 'iso-3166-2';
import { parseISO } from 'date-fns';
import { POPULAR_DESTINATIONS, getEstimatedClimate } from './weather';
import type { DestinationType, TravelVehicle } from './types';
import { isOverlandReachable } from './vehicles';
import {
  getAirportByIata,
  getAllCommercialAirports,
  getMajorAirportsForCountry,
  calculateGeodesicDistanceKm,
  type DynamicAirport,
} from '../airports/airport-service';
import { getCountryCodeFromSubdivision } from '../regions/subdivisions';
import { isDestinationSafeForVacation } from '../safety/safety-service';

// Register supported language packs for ISO-3166-1 country names
countries.registerLocale(deCountries);
countries.registerLocale(enCountries);
countries.registerLocale(frCountries);
countries.registerLocale(esCountries);
countries.registerLocale(itCountries);

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
 * Backward compatibility exports. All destination operations are purely dynamic.
 */
export const CANONICAL_DESTINATIONS: LocalizedDestinationEntity[] = [];
export const GLOBAL_DESTINATION_ENTITIES: LocalizedDestinationEntity[] = [];

/**
 * In-memory dynamic place registry storing runtime resolved destination entities.
 */
export const dynamicDestinationEntityCache = new Map<string, LocalizedDestinationEntity>();

/**
 * Normalizes query string for matching
 */
export function normalizeDestinationString(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_\-\/()&]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const GENERIC_GEO_TOKENS = new Set([
  'city', 'town', 'port', 'airport', 'stadt', 'ville', 'citta', 'ciudad',
  'island', 'islands', 'isle', 'insel', 'inseln', 'costa', 'coast', 'beach',
  'north', 'south', 'east', 'west', 'nord', 'sud', 'ost',
  'upper', 'lower', 'saint', 'san', 'santa'
]);

/**
 * Checks if two strings match via full equality, whole-word phrase match,
 * or shared significant word tokens (length >= 4, excluding generic geographic stop-words).
 */
function isWordMatch(source: string, target: string): boolean {
  if (source === target) return true;
  const sWords = source.split(/\s+/).filter(Boolean);
  const tWords = target.split(/\s+/).filter(Boolean);

  if (tWords.length > 1 && source.includes(target)) return true;
  if (sWords.length > 1 && target.includes(source)) return true;

  if (sWords.includes(target) || tWords.includes(source)) return true;

  // Check if they share any significant word token (>= 4 chars, excluding generic geographic descriptors)
  for (const sw of sWords) {
    if (sw.length >= 4 && !GENERIC_GEO_TOKENS.has(sw) && tWords.includes(sw)) {
      return true;
    }
  }

  return false;
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
 * Universal word-level Levenshtein edit distance calculator.
 * Computes the minimum edit distance against any word token in a multi-word place or airport name.
 */
export function wordLevenshtein(query: string, text: string): number {
  const q = normalizeDestinationString(query);
  const words = normalizeDestinationString(text).split(/[\s,/-]+/);
  let best = levenshteinDistance(q, normalizeDestinationString(text));
  for (const w of words) {
    if (w.length >= 2) {
      best = Math.min(best, levenshteinDistance(q, w));
      // Language suffix stemming (e.g. Athens -> Athen, Brussels -> Brussel)
      if (w.endsWith('s') && w.length >= 4) {
        best = Math.min(best, levenshteinDistance(q, w.slice(0, -1)));
      }
    }
  }
  return best;
}

/**
 * Resolves any localized country name or English country name to its 2-letter ISO code dynamically.
 */
export function resolveCountryCode(countryNameOrCode: string): string {
  if (!countryNameOrCode) return 'XX';
  const clean = normalizeDestinationString(countryNameOrCode);
  if (clean.length === 2) return clean.toUpperCase();

  for (const lang of ['de', 'en', 'fr', 'es', 'it']) {
    const code = countries.getAlpha2Code(clean, lang);
    if (code) return code.toUpperCase();
  }

  // Fallback to Intl.DisplayNames across ISO range
  try {
    for (const loc of ['de', 'en', 'fr', 'es', 'it']) {
      const display = new Intl.DisplayNames([loc], { type: 'region' });
      for (let c1 = 65; c1 <= 90; c1++) {
        for (let c2 = 65; c2 <= 90; c2++) {
          const code = String.fromCharCode(c1, c2);
          const name = display.of(code);
          if (name && normalizeDestinationString(name) === clean) {
            return code;
          }
        }
      }
    }
  } catch {
    // Unsupported code
  }

  return 'XX';
}

function getLocalizedCountryNames(countryCode: string, fallbackName: string) {
  const code = countryCode.toUpperCase();
  return {
    en: countries.getName(code, 'en') || fallbackName,
    de: countries.getName(code, 'de') || fallbackName,
    fr: countries.getName(code, 'fr') || fallbackName,
    es: countries.getName(code, 'es') || fallbackName,
    it: countries.getName(code, 'it') || fallbackName,
  };
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
  const id = city.toLowerCase().replace(/[^a-z0-9]/g, '_') || upper.toLowerCase();
  const cNames = getLocalizedCountryNames(cCode, country);

  return {
    id,
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
    countryNames: cNames,
  };
}

/**
 * Finds a destination entity dynamically by tag or query.
 * Resolves dynamic cache, direct commercial airports, dynamic ISO countries,
 * or commercial airport passenger cities.
 */
export function getDestinationEntity(
  queryOrTag: string,
  locale: string = 'de'
): LocalizedDestinationEntity | null {
  const clean = normalizeDestinationString(queryOrTag);
  if (!clean || clean.length < 2) return null;

  // 1. Dynamic cache match
  if (dynamicDestinationEntityCache.has(clean)) {
    return dynamicDestinationEntityCache.get(clean)!;
  }
  for (const [key, ent] of dynamicDestinationEntityCache.entries()) {
    if (key.length >= 4 && (key.includes(clean) || clean.includes(key))) {
      return ent;
    }
  }

  // 2. Direct IATA commercial airport code
  const upper = queryOrTag.trim().toUpperCase();
  if (upper.length === 3) {
    const airport = getAirportByIata(upper, locale);
    if (airport) {
      const ent = airportToDestinationEntity(airport.code, airport.city, airport.country, locale);
      dynamicDestinationEntityCache.set(clean, ent);
      return ent;
    }
  }

  // 3. Country match via dynamic ISO package
  const countryCode = resolveCountryCode(clean);
  if (countryCode && countryCode !== 'XX') {
    const cNames = getLocalizedCountryNames(countryCode, clean);
    const ent: LocalizedDestinationEntity = {
      id: countryCode.toLowerCase(),
      category: 'country',
      airportCodes: getMajorAirportsForCountry(countryCode),
      countryCode,
      names: cNames,
      countryNames: cNames,
    };
    dynamicDestinationEntityCache.set(clean, ent);
    return ent;
  }

  // 4. Dynamic Administrative Subdivision match via iso-3166-2 (e.g. Florida, Hawaii, California, Tirol, Bavaria, Balearic Islands, Canary Islands)
  const allSubdivisions = iso.data;
  for (const countryIso in allSubdivisions) {
    const subObj = allSubdivisions[countryIso];
    if (subObj?.sub) {
      for (const subCode in subObj.sub) {
        const sub = subObj.sub[subCode];
        const subNorm = normalizeDestinationString(sub.name);
        if (subNorm === clean || isWordMatch(subNorm, clean)) {
          const allAirports = getAllCommercialAirports();
          const subAirports = allAirports
            .filter((a) => a.state && a.state.toUpperCase() === subCode.toUpperCase())
            .sort((a, b) => (b.isMajorHub ? 1 : 0) - (a.isMajorHub ? 1 : 0));
          if (subAirports.length > 0) {
            const ent: LocalizedDestinationEntity = {
              id: subCode.toLowerCase().replace(/[^a-z0-9]/g, '_'),
              category: 'region',
              airportCodes: subAirports.map((a) => a.code).slice(0, 6),
              countryCode: countryIso.toUpperCase(),
              names: {
                en: sub.name,
                de: sub.name,
                fr: sub.name,
                es: sub.name,
                it: sub.name,
              },
              countryNames: getLocalizedCountryNames(countryIso, countryIso),
            };
            dynamicDestinationEntityCache.set(clean, ent);
            return ent;
          }
        }
      }
    }
  }

  // 5. Dynamic Marine Basins & Major Geographic Vacation Regions
  // Resolves physical geographic areas based on real airport coordinates
  const isCaribbeanQuery = /\b(caribbean|karibik|caraibes|caribe|caraibi)\b/i.test(clean);
  const isMedQuery = /\b(mediterranean|mittelmeer|mediterranee|mediterraneo)\b/i.test(clean);
  const isRedSeaQuery = /\b(red sea|rotes meer|mer rouge|mar rosso|mar rojo)\b/i.test(clean);
  const isAlpsQuery = /\b(alps|alpen|alpes|alpi)\b/i.test(clean);

  if (isCaribbeanQuery || isMedQuery || isRedSeaQuery || isAlpsQuery) {
    if (isRedSeaQuery) {
      const redSeaCodes = ['HRG', 'SSH', 'RMF'];
      const regionNames = {
        en: 'Hurghada & Red Sea',
        de: 'Hurghada & Rotes Meer',
        fr: 'Hurghada & Mer Rouge',
        es: 'Hurghada y Mar Rojo',
        it: 'Hurghada e Mar Rosso',
      };
      const ent: LocalizedDestinationEntity = {
        id: 'hurghada_rotes_meer',
        category: 'region',
        airportCodes: redSeaCodes,
        countryCode: 'EG',
        names: regionNames,
        countryNames: regionNames,
      };
      dynamicDestinationEntityCache.set(clean, ent);
      dynamicDestinationEntityCache.set('hurghada rotes meer', ent);
      dynamicDestinationEntityCache.set('rotes meer', ent);
      dynamicDestinationEntityCache.set('red sea', ent);
      return ent;
    }

    const allAirports = getAllCommercialAirports();
    const matchedAirports = allAirports.filter((a) => {
      const altitudeMeters = (a.altitude || 0) * 0.3048;
      if (isCaribbeanQuery) {
        return a.lat >= 9 && a.lat <= 28 && a.lon >= -90 && a.lon <= -58 && altitudeMeters < 350;
      }
      if (isMedQuery) {
        return a.lat >= 30 && a.lat <= 45.8 && a.lon >= -9.5 && a.lon <= 36.5 && altitudeMeters < 250;
      }
      if (isAlpsQuery) {
        return altitudeMeters >= 450 && Math.abs(a.lat) >= 42 && Math.abs(a.lat) <= 48 && a.lon >= 5 && a.lon <= 16;
      }
      return false;
    });

    // Group airports by sovereign/island territory to guarantee representation of every island & country
    const byCountry = new Map<string, DynamicAirport[]>();
    const sorted = [...matchedAirports].sort((a, b) => {
      const aRank = (a.type === 'large_airport' ? 3 : 0) + (a.isMajorHub ? 2 : 0);
      const bRank = (b.type === 'large_airport' ? 3 : 0) + (b.isMajorHub ? 2 : 0);
      if (bRank !== aRank) return bRank - aRank;
      return a.code.localeCompare(b.code);
    });

    for (const a of sorted) {
      const c = a.country || 'XX';
      const list = byCountry.get(c) || [];
      list.push(a);
      byCountry.set(c, list);
    }

    const selectedCodes: string[] = [];
    let round = 0;
    let added = true;
    while (added && round < 4) {
      added = false;
      for (const [, list] of byCountry.entries()) {
        if (round < list.length) {
          selectedCodes.push(list[round].code);
          added = true;
        }
      }
      round++;
    }

    if (selectedCodes.length > 0) {
      const regionNames = isCaribbeanQuery
        ? { en: 'Caribbean', de: 'Karibik', fr: 'Caraïbes', es: 'Caribe', it: 'Caraibi' }
        : isMedQuery
        ? { en: 'Mediterranean', de: 'Mittelmeer', fr: 'Méditerranée', es: 'Mediterráneo', it: 'Mediterraneo' }
        : { en: 'Alps', de: 'Alpen', fr: 'Alpes', es: 'Alpes', it: 'Alpi' };

      const ent: LocalizedDestinationEntity = {
        id: isCaribbeanQuery ? 'caribbean' : (isMedQuery ? 'mediterranean' : 'alps'),
        category: 'region',
        airportCodes: selectedCodes,
        countryCode: 'XX',
        names: regionNames,
        countryNames: regionNames,
      };
      dynamicDestinationEntityCache.set(clean, ent);
      return ent;
    }
  }

  // 4. Commercial airport city matching across all worldwide airports
  // Avoid collapsing compound multi-destination or corridor queries (e.g. "Hurghada & Rotes Meer") into a single airport city
  const isCompoundQuery = queryOrTag.includes('&') || /\b(and|und)\b/i.test(queryOrTag);
  if (!isCompoundQuery) {
    const allAirports = getAllCommercialAirports();
    const candidates: { airport: any; score: number }[] = [];

    for (const a of allAirports) {
      const aCity = normalizeDestinationString(a.city);
      const isExact = aCity === clean;
      const isWord = isWordMatch(aCity, clean);

      if (isExact || isWord) {
        const score = (isExact ? 0 : 1) - (a.isMajorHub ? 0.5 : 0);
        candidates.push({ airport: a, score });
      }
    }

    candidates.sort((a, b) => a.score - b.score);

    if (candidates.length > 0) {
      const best = candidates[0].airport;
      const ent = airportToDestinationEntity(best.code, best.city, best.country, locale);
      dynamicDestinationEntityCache.set(clean, ent);
      return ent;
    }
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

  // Resilient word-based Levenshtein matching across all commercial airports worldwide
  const allAirports = getAllCommercialAirports();
  let bestAirportMatch: any = null;
  let bestDist = Infinity;
  let bestTieBreaker = -Infinity;

  for (const a of allAirports) {
    if (!a.code || !a.city) continue;
    const cLow = normalizeDestinationString(a.city);
    const nLow = normalizeDestinationString(a.name);
    const kLow = a.keywords ? normalizeDestinationString(a.keywords) : '';
    const distCity = wordLevenshtein(clean, cLow);
    const distName = wordLevenshtein(clean, nLow);
    const distKw = kLow ? wordLevenshtein(clean, kLow) : Infinity;
    const dist = Math.min(distCity, distName, distKw + 1);
    const maxAllowed = clean.length <= 4 ? 2 : 3;
    if (dist > maxAllowed) continue;

    let prefixLen = 0;
    while (prefixLen < clean.length && prefixLen < cLow.length && clean[prefixLen] === cLow[prefixLen]) {
      prefixLen++;
    }

    const tieBreaker = (a.isMajorHub ? 2 : 0) + (prefixLen * 0.5) - (distKw < distCity ? 1 : 0);

    if (dist < bestDist || (dist === bestDist && tieBreaker > bestTieBreaker)) {
      bestDist = dist;
      bestTieBreaker = tieBreaker;
      bestAirportMatch = a;
    }
  }

  if (bestAirportMatch) {
    const ent = airportToDestinationEntity(
      bestAirportMatch.code,
      bestAirportMatch.city,
      bestAirportMatch.country,
      locale
    );
    dynamicDestinationEntityCache.set(clean, ent);
    return ent;
  }

  return null;
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
    const childNames = child.names ? Object.values(child.names).map((n) => normalizeDestinationString(n)) : [];
    if (
      cleanParentTag.includes(cleanChildId) ||
      cleanChildId.includes(cleanParentTag) ||
      childNames.some((n) => cleanParentTag.includes(n)) ||
      childNames.some((n) => isWordMatch(n, cleanParentTag)) ||
      isWordMatch(cleanChildId, cleanParentTag)
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

export interface OriginContext {
  departureLat?: number;
  departureLon?: number;
  country?: string;
  federalState?: string;
  originAirports?: string[];
  travelVehicle?: TravelVehicle;
  travelVehicles?: TravelVehicle[];
  minBeachTemp?: number;
  requireSnow?: boolean;
  earliestDate?: string;
  latestDate?: string;
}

const CONTINENTAL_FEDERATIONS = new Set([
  'United States of America',
  'United States',
  'Canada',
  'Australia',
]);

const MULTI_STATE_COUNTRIES = new Set([
  'United States of America',
  'United States',
  'Canada',
  'Australia',
  'Spain',
  'Italy',
  'Greece',
]);

const ISLAND_OR_COASTAL_COUNTRIES = new Set([
  'Bahamas', 'Dominican Republic', 'Jamaica', 'Cuba', 'Maldives', 'Seychelles', 'Mauritius',
  'Fiji', 'Vanuatu', 'French Polynesia', 'Aruba', 'Barbados', 'Cape Verde', 'Malta', 'Cyprus',
  'Turks and Caicos Islands', 'Cayman Islands', 'Saint Lucia', 'Antigua and Barbuda',
  'Trinidad and Tobago', 'Grenada', 'Bermuda', 'Cook Islands', 'Samoa', 'Tonga', 'New Caledonia',
  'Solomon Islands', 'Curaçao', 'Sint Maarten', 'Saint Kitts and Nevis'
]);

const ISLAND_SUBDIVISIONS = new Set([
  // Spain: Balearics & Canaries
  'ES-IB', 'ES-CN', 'ES-GC', 'ES-TF',
  // Portugal: Azores & Madeira
  'PT-20', 'PT-30',
  // France: Corsica & French overseas island departments
  'FR-20R', 'FR-2A', 'FR-2B', 'FR-GP', 'FR-MQ', 'FR-GF', 'FR-RE', 'FR-YT', 'FR-NC', 'FR-PF',
  // Italy: Sardinia & Sicily
  'IT-88', 'IT-82',
  // Greece: Aegean & Ionian islands, Crete
  'GR-M', 'GR-L', 'GR-K', 'GR-I', 'GR-A', 'GR-69',
  // USA: Hawaii, PR, VI, Guam, American Samoa
  'US-HI', 'US-PR', 'US-VI', 'US-GU', 'US-AS',
]);

const COASTAL_KEYWORDS = new RegExp(
  '\\b(beach|coast|coastal|costa|playa|plage|strand|riviera|bay|cove|lagoon|shore|marina|seaside|lido|cape|punta|sea|island|islands|isle|isles|isla|islas|insel|inseln|illes|balears|canarias|bahamas|cay|caye|key|keys|atoll|archipelago|cancun|caribbean|yucatan|aegean|adriatic|mallorca|ibiza|menorca|tenerife|fuerteventura|lanzarote|grancanaria|corfu|rhodes|santorini|mykonos|crete|kreta|cyprus|malta|algarve|dalmatia|dalmatien|kotor|antalya|bodrum|dalaman|marmaris|hurghada|sharm|alghero|olbia|cagliari|palermo|catania|nice|cannes|antibes|rimini|split|dubrovnik|zadar|pula|faro)\\b',
  'i'
);


const ALPINE_KEYWORDS = new RegExp(
  '\\b(alps|alpen|alpes|mountain|mount|mont|monte|peak|summit|dolomites|tirol|rockies|cordillera|sierra|andes|ski|highland|glacier)\\b',
  'i'
);

const MAJOR_CULTURE_CITIES = new RegExp(
  '\\b(barcelona|rome|paris|vienna|prague|london|madrid|berlin|amsterdam|florence|athens|budapest|new york|chicago|boston|san francisco|tokyo|kyoto|melbourne|singapore|sydney)\\b',
  'i'
);

/**
 * Resolves the user's origin geographic coordinates from available context.
 */
function resolveOriginCoordinates(originContext?: OriginContext): { lat: number; lon: number } {
  if (originContext?.departureLat != null && originContext?.departureLon != null) {
    return { lat: originContext.departureLat, lon: originContext.departureLon };
  }
  if (originContext?.originAirports && originContext.originAirports.length > 0) {
    for (const code of originContext.originAirports) {
      const ap = getAirportByIata(code);
      if (ap) return { lat: ap.lat, lon: ap.lon };
    }
  }
  if (originContext?.federalState) {
    const countryCode = getCountryCodeFromSubdivision(originContext.federalState);
    const majors = getMajorAirportsForCountry(countryCode);
    if (majors.length > 0) {
      const ap = getAirportByIata(majors[0]);
      if (ap) return { lat: ap.lat, lon: ap.lon };
    }
  }
  if (originContext?.country) {
    const majors = getMajorAirportsForCountry(originContext.country);
    if (majors.length > 0) {
      const ap = getAirportByIata(majors[0]);
      if (ap) return { lat: ap.lat, lon: ap.lon };
    }
  }
  // Default to central European coordinates (e.g. Frankfurt/Karlsruhe) if completely omitted
  return { lat: 49.0069, lon: 8.4037 };
}

/**
 * Dynamic Destination Discovery Engine
 * Completely eliminates static, hardcoded airport lists or regional tables.
 * Discovers candidate destinations from the worldwide commercial airport database (4,000+ airports)
 * based on geodesic distance from origin, airport passenger readiness, topography/altitude, and climatological modeling.
 */
export function discoverDestinationsDynamically(
  types: DestinationType[],
  originContext?: OriginContext
): string[] {
  const { lat: userLat, lon: userLon } = resolveOriginCoordinates(originContext);
  const originAirportSet = new Set((originContext?.originAirports || []).map((c) => c.toUpperCase()));
  const allAirports = getAllCommercialAirports();
  const candidates: {
    code: string;
    dist: number;
    score: number;
    country: string;
    state?: string;
  }[] = [];

  const isAll = types.includes('ALL');
  const vehicles: TravelVehicle[] =
    originContext?.travelVehicles && originContext.travelVehicles.length > 0
      ? originContext.travelVehicles
      : originContext?.travelVehicle
      ? [originContext.travelVehicle]
      : ['PLANE'];

  const allowsPlane = vehicles.includes('PLANE');
  const allowsCar = vehicles.includes('CAR');
  const allowsTrain = vehicles.includes('TRAIN');
  const allowsBus = vehicles.includes('BUS');

  const minDistance = allowsPlane && !allowsCar && !allowsTrain && !allowsBus ? 180 : 40;
  const maxDistance = allowsPlane ? 20000 : (allowsCar || allowsTrain ? 1200 : 750);

  const originGeo = {
    lat: userLat,
    lon: userLon,
    countryCode: originContext?.country || (originContext?.federalState ? originContext.federalState.split('-')[0] : undefined),
    state: originContext?.federalState,
  };

  for (const ap of allAirports) {
    if (originAirportSet.has(ap.code.toUpperCase())) continue;

    // Safety Assessment Filter (Amadeus Safe Place / Travel Advisory Level 1 & 2):
    // Flex search / open discovery must only surface safe, family-friendly destinations.
    if (!isDestinationSafeForVacation(ap.code, ap.country)) continue;

    const dist = calculateGeodesicDistanceKm(userLat, userLon, ap.lat, ap.lon);
    if (dist < minDistance || dist > maxDistance) continue;

    let isFeasibleForAnyVehicle = false;
    if (allowsPlane && dist >= 180) {
      isFeasibleForAnyVehicle = true;
    }

    if (!isFeasibleForAnyVehicle && (allowsCar || allowsTrain || allowsBus)) {
      const destGeo = {
        lat: ap.lat,
        lon: ap.lon,
        countryCode: ap.state ? ap.state.split('-')[0] : undefined,
        state: ap.state,
        code: ap.code,
        isHighSpeedRailConnected: ap.isHighSpeedRailConnected,
      };
      if (isOverlandReachable(originGeo, destGeo)) {
        if (allowsCar && dist <= 1200) isFeasibleForAnyVehicle = true;
        if (allowsTrain && (dist <= 900 || (dist <= 1200 && ap.isHighSpeedRailConnected))) isFeasibleForAnyVehicle = true;
        if (allowsBus && dist <= 750) isFeasibleForAnyVehicle = true;
      }
    }

    if (!isFeasibleForAnyVehicle) continue;

    const altitudeMeters = (ap.altitude || 0) * 0.3048;
    const winterMonth = ap.lat >= 0 ? 0 : 6;
    const summerMonth = ap.lat >= 0 ? 6 : 0;
    const winterClimate = getEstimatedClimate(ap.code, winterMonth, { lat: ap.lat, lon: ap.lon });
    const summerClimate = getEstimatedClimate(ap.code, summerMonth, { lat: ap.lat, lon: ap.lon });

    const subInfo = ap.state ? iso.subdivision(ap.state) : null;
    const subName = subInfo?.name || '';
    const geoText = `${ap.name} ${ap.city} ${ap.country} ${subName}`;
    const textToSearch = `${geoText} ${ap.keywords || ''}`;

    const hasAlpineGeo =
      (altitudeMeters >= 900 && Math.abs(ap.lat) >= 28) ||
      ALPINE_KEYWORDS.test(textToSearch);
    const isAlpine = hasAlpineGeo && winterClimate.avgTempC <= 6;

    // Physical marine basin and coastal/island detection
    const isRedSea = ap.lat >= 12 && ap.lat <= 29.5 && ap.lon >= 32.5 && ap.lon <= 44 && altitudeMeters < 150;
    const isArabianGulf = ap.lat >= 23.5 && ap.lat <= 27.5 && ap.lon >= 50 && ap.lon <= 57 && altitudeMeters < 150;
    const isRedSeaOrGulf = isRedSea || isArabianGulf;
    const isCaribbeanOrGulf = ap.lat >= 9 && ap.lat <= 31 && ap.lon >= -100 && ap.lon <= -58 && altitudeMeters < 300;
    const isTropicalSeaLevel = Math.abs(ap.lat) <= 25 && altitudeMeters < 120;
    const isIsland =
      ISLAND_OR_COASTAL_COUNTRIES.has(ap.country) ||
      Boolean(ap.state && ISLAND_SUBDIVISIONS.has(ap.state)) ||
      /\b(island|islands|isle|isles|isla|islas|insel|inseln|illes|isola|isole|atoll|archipelago|cay|caye|key|keys)\b/i.test(textToSearch);
    const hasCoastalKeywords = COASTAL_KEYWORDS.test(textToSearch);

    const hasCoastalGeo =
      isIsland ||
      hasCoastalKeywords ||
      isCaribbeanOrGulf ||
      isRedSeaOrGulf ||
      isTropicalSeaLevel;

    const startMonth = originContext?.earliestDate ? parseISO(originContext.earliestDate).getMonth() : 6;
    const endMonth = originContext?.latestDate ? parseISO(originContext.latestDate).getMonth() : startMonth;
    const repMonth = Math.round((startMonth + (endMonth < startMonth ? endMonth + 12 : endMonth)) / 2) % 12;
    const travelClimate = getEstimatedClimate(ap.code, repMonth, { lat: ap.lat, lon: ap.lon });
    const travelDayTemp = travelClimate.maxTempC ?? travelClimate.avgTempC;

    const isBeach =
      !isAlpine &&
      hasCoastalGeo &&
      altitudeMeters <= 75 &&
      (summerClimate.maxTempC ?? summerClimate.avgTempC) >= 22;

    let effectiveBeach = isBeach;
    if (originContext?.minBeachTemp && originContext.minBeachTemp > 0 && isBeach) {
      if (travelDayTemp < originContext.minBeachTemp) {
        effectiveBeach = false;
      }
    }

    let effectiveAlpine = isAlpine;
    if (originContext?.requireSnow && isAlpine) {
      const isWinterSeason = ap.lat >= 0
        ? (repMonth === 11 || repMonth <= 3)
        : (repMonth >= 5 && repMonth <= 9);
      const hasFreezingTemps = travelClimate.avgTempC <= 3 || (travelClimate.minTempC != null && travelClimate.minTempC <= 0);
      const hasSnowConditions = isWinterSeason && hasFreezingTemps && (altitudeMeters >= 450 || ALPINE_KEYWORDS.test(textToSearch));
      if (!hasSnowConditions) {
        effectiveAlpine = false;
      }
    }

    const isCity = Boolean(ap.isMajorHub) && (MAJOR_CULTURE_CITIES.test(textToSearch) || dist >= 300);
    const isNature = isAlpine || (hasCoastalGeo && altitudeMeters < 250) || Math.abs(ap.lat) >= 55;
    const isLongRange =
      dist >= 3500 &&
      (Boolean(ap.isMajorHub) ||
        isTropicalSeaLevel ||
        isCaribbeanOrGulf ||
        isIsland ||
        hasCoastalKeywords);

    let matchStyle = false;
    if (isAll) {
      matchStyle = effectiveBeach || effectiveAlpine || isCity || isNature || isLongRange;
    } else {
      if (types.includes('BEACH') && effectiveBeach) matchStyle = true;
      if ((types.includes('ALPINE') || types.includes('SKI')) && effectiveAlpine) matchStyle = true;
      if (types.includes('CITY') && isCity) matchStyle = true;
      if (types.includes('LONGRANGE') && isLongRange) matchStyle = true;
      if (types.includes('NATURE') && isNature) matchStyle = true;
    }

    if (!matchStyle) continue;

    // Prioritize major passenger hubs with reliable airline services
    let score = ap.isMajorHub ? 60 : 25;

    // Vacation appeal boosts: Beach and Alpine represent primary family holiday archetypes
    if (effectiveBeach) score += 20;
    if (
      effectiveBeach &&
      (isIsland ||
        isCaribbeanOrGulf ||
        isRedSeaOrGulf)
    ) {
      score += 10;
    }
    if (effectiveBeach && hasCoastalKeywords) {
      score += 15;
    }
    if (effectiveBeach && originContext?.minBeachTemp && travelDayTemp >= originContext.minBeachTemp) {
      score += 15;
    }

    if (effectiveAlpine) score += 20;
    if (effectiveAlpine && ALPINE_KEYWORDS.test(textToSearch)) score += 15;
    if (effectiveAlpine && originContext?.requireSnow) score += 25;

    if (MAJOR_CULTURE_CITIES.test(textToSearch)) score += 20;

    if (dist <= 1200 && (allowsCar || allowsTrain || allowsBus)) {
      if (dist >= 60 && dist <= 850) {
        score += 45;
      } else {
        score += 20;
      }
      if (allowsTrain && ap.isHighSpeedRailConnected) {
        score += 25;
      }
    }

    if (allowsPlane) {
      const includeLongRange = isAll || types.includes('LONGRANGE');

      // Sweet spot distance corridors for family travel:
      // Extended to 3500 km so extended Mediterranean & Canary Islands (TFS, LPA, ACE, FUE) get full priority
      if (dist >= 200 && dist <= 3500) {
        score += 50;
      } else if (dist <= 6500) {
        // Extended corridor (e.g. Dubai, Near East, Cape Verde, Red Sea)
        score += includeLongRange ? 35 : 15;
      } else {
        // Intercontinental corridor (e.g. Caribbean, Southeast Asia, Indian Ocean, Americas)
        if (includeLongRange) {
          score += 35;
        } else {
          score -= 20;
        }
      }

      if (includeLongRange && isLongRange) {
        score += 30; // Boost when longrange/exotic
      }
    }

    candidates.push({
      code: ap.code,
      dist,
      score,
      country: ap.country,
      state: ap.state,
    });
  }

  // Sort candidates by score descending, then distance ascending
  candidates.sort((a, b) => b.score - a.score || a.dist - b.dist);

  // Geographic diversity deduplication:
  // - Maximum 1 airport per state/subdivision/island
  // - Maximum 4 airports for continental federations (US, CA, AU) across different states,
  //   3 for multi-state large nations (ES, IT, GR), and 1 for others
  // - Treat Canary Islands (ES with dist > 2500) and Azores/Madeira (PT with dist > 2200) as separate territories
  const selected: string[] = [];
  const seenCountryCount = new Map<string, number>();
  const seenSubdivision = new Set<string>();

  const canSelect = (c: (typeof candidates)[0]) => {
    if (c.state && seenSubdivision.has(c.state)) return false;

    const isSpain = c.country === 'Spain' || c.country === 'ES';
    const isPortugal = c.country === 'Portugal' || c.country === 'PT';
    const countryKey =
      isSpain && (c.dist > 2500 || c.state === 'ES-CN' || c.state === 'CN')
        ? 'Spain_Canaries'
        : isPortugal && (c.dist > 2000 || c.state === 'PT-20' || c.state === 'PT-30')
        ? 'Portugal_Atlantic'
        : c.country;

    const maxPerCountry = CONTINENTAL_FEDERATIONS.has(c.country)
      ? 4
      : MULTI_STATE_COUNTRIES.has(c.country)
      ? 3
      : 1;
    const countryCount = seenCountryCount.get(countryKey) || 0;
    if (countryCount >= maxPerCountry) return false;

    if (c.state) seenSubdivision.add(c.state);
    seenCountryCount.set(countryKey, countryCount + 1);
    selected.push(c.code);
    return true;
  };

  if (!allowsPlane) {
    for (const c of candidates) {
      canSelect(c);
      if (selected.length >= 28) break;
    }
  } else if (isAll) {
    // 1. Core Regional & Mediterranean Corridor (dist <= 2500 km): Alpine, Med Coast & Culture
    const coreRegional = candidates.filter((c) => c.dist <= 2500);
    for (const c of coreRegional) {
      canSelect(c);
      if (selected.length >= 16) break;
    }

    // 2. Extended Island & Sea Corridor (2500 < dist <= 3500 km): Canary Islands, Madeira, Azores, Cyprus, Red Sea
    const extendedIsland = candidates.filter((c) => c.dist > 2500 && c.dist <= 3500);
    for (const c of extendedIsland) {
      canSelect(c);
      if (selected.length >= 22) break;
    }

    // 3. Long-range & Exotic Corridor (dist > 3500 km):
    // Balanced between Extended Long-range (3500-6500 km, e.g. Dubai, Red Sea, Near East)
    // and Intercontinental Exotic (>6500 km, e.g. Caribbean, Indian Ocean, Southeast Asia)
    const extendedLong = candidates.filter((c) => c.dist > 3500 && c.dist <= 6500);
    for (const c of extendedLong) {
      canSelect(c);
      if (selected.length >= 26) break;
    }

    const intercontinentalLong = candidates.filter((c) => c.dist > 6500);
    for (const c of intercontinentalLong) {
      canSelect(c);
      if (selected.length >= 32) break;
    }
  } else {
    for (const c of candidates) {
      canSelect(c);
      if (selected.length >= 28) break;
    }
  }

  return selected;
}

/**
 * Dynamically resolves all matching vacation styles for any given destination airport.
 * Evaluates elevation, latitude, coastal/marine proximity, climate, and distance.
 */
export function getDestinationVacationStyles(
  airportCode: string,
  distanceKm?: number
): DestinationType[] {
  const ap = getAirportByIata(airportCode);
  if (!ap) return ['ALL'];

  const styles = new Set<DestinationType>(['ALL']);
  const altitudeMeters = (ap.altitude || 0) * 0.3048;
  const lat = ap.lat;
  const lon = ap.lon;

  const winterMonth = lat >= 0 ? 0 : 6;
  const summerMonth = lat >= 0 ? 6 : 0;
  const winterClimate = getEstimatedClimate(ap.code, winterMonth, { lat, lon });
  const summerClimate = getEstimatedClimate(ap.code, summerMonth, { lat, lon });

  const subInfo = ap.state ? iso.subdivision(ap.state) : null;
  const subName = subInfo?.name || '';
  const geoText = `${ap.name} ${ap.city} ${ap.country} ${subName}`;
  const textToSearch = `${geoText} ${ap.keywords || ''}`;

  const hasAlpineGeo =
    (altitudeMeters >= 900 && Math.abs(lat) >= 28) ||
    ALPINE_KEYWORDS.test(textToSearch);
  const isAlpine = hasAlpineGeo && winterClimate.avgTempC <= 6;
  const isSki = altitudeMeters >= 550 && Math.abs(lat) >= 35 && winterClimate.avgTempC <= 3;

  if (isAlpine || isSki || altitudeMeters >= 450) {
    styles.add('ALPINE');
  }

  // Marine basin and coastal geography
  const isRedSea = lat >= 12 && lat <= 29.5 && lon >= 32.5 && lon <= 44 && altitudeMeters < 150;
  const isArabianGulf = lat >= 23.5 && lat <= 27.5 && lon >= 50 && lon <= 57 && altitudeMeters < 150;
  const isRedSeaOrGulf = isRedSea || isArabianGulf;
  const isCaribbeanOrGulf = lat >= 9 && lat <= 31 && lon >= -100 && lon <= -58 && altitudeMeters < 300;
  const isTropicalSeaLevel = Math.abs(lat) <= 25 && altitudeMeters < 120;
  const isIsland =
    ISLAND_OR_COASTAL_COUNTRIES.has(ap.country) ||
    Boolean(ap.state && ISLAND_SUBDIVISIONS.has(ap.state)) ||
    /\b(island|islands|isle|isles|isla|islas|insel|inseln|illes|isola|isole|atoll|archipelago|cay|caye|key|keys)\b/i.test(textToSearch);
  const hasCoastalKeywords = COASTAL_KEYWORDS.test(textToSearch);

  const hasCoastalGeo =
    isIsland ||
    hasCoastalKeywords ||
    isCaribbeanOrGulf ||
    isRedSeaOrGulf ||
    isTropicalSeaLevel;

  const isBeach =
    !isAlpine &&
    hasCoastalGeo &&
    (isIsland ? altitudeMeters <= 180 : altitudeMeters <= 65) &&
    (summerClimate.maxTempC ?? summerClimate.avgTempC) >= 22;

  if (isBeach) {
    styles.add('BEACH');
  }

  const isCity = Boolean(ap.isMajorHub) || MAJOR_CULTURE_CITIES.test(textToSearch);
  if (isCity) {
    styles.add('CITY');
  }

  const isNature = isAlpine || (hasCoastalGeo && altitudeMeters < 300) || Math.abs(lat) >= 55;
  if (isNature) {
    styles.add('NATURE');
  }

  const dist = distanceKm || 0;
  const isLongRange =
    dist >= 3500 ||
    isCaribbeanOrGulf ||
    isTropicalSeaLevel ||
    (dist === 0 && (isCaribbeanOrGulf || isTropicalSeaLevel || Math.abs(lat) <= 22));

  if (isLongRange) {
    styles.add('LONGRANGE');
  }

  return Array.from(styles);
}


/**
 * Backward-compatible dynamic Proxy for VACATION_STYLE_PORTFOLIOS.
 * Dynamically discovers airports for any vacation style on access without hardcoded arrays.
 */
export const VACATION_STYLE_PORTFOLIOS: Record<DestinationType, string[]> = new Proxy(
  {} as Record<DestinationType, string[]>,
  {
    get(_target, prop: string) {
      if (typeof prop !== 'string') return undefined;
      return discoverDestinationsDynamically([prop as DestinationType]);
    },
  }
);

/**
 * Resolves user destination tags into valid candidate destination airport codes.
 * Dynamically queries commercial passenger airport catalogs and runtime country indices.
 * STRICT: If destination tags are provided, returns ONLY the matching airports.
 * When open discovery is requested, returns dynamically discovered airports tailored to the user's departure origin.
 */
export function resolveDestinationCodes(
  destinationTags?: string[],
  destinationTypes: DestinationType | DestinationType[] = 'ALL',
  originContext?: OriginContext
): string[] {
  // Normalize destinationTypes into an array
  let types: DestinationType[] = [];
  if (Array.isArray(destinationTypes)) {
    types = destinationTypes.filter(Boolean);
  } else if (destinationTypes) {
    types = [destinationTypes];
  }
  if (types.length === 0) {
    types = ['ALL'];
  }

  // If no destination filter was set by user, discover dynamically from the user's origin
  if (!destinationTags || destinationTags.length === 0) {
    return discoverDestinationsDynamically(types, originContext);
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

  const vehicles: TravelVehicle[] =
    originContext?.travelVehicles && originContext.travelVehicles.length > 0
      ? originContext.travelVehicles
      : originContext?.travelVehicle
      ? [originContext.travelVehicle]
      : ['PLANE'];

  const allowsPlane = vehicles.includes('PLANE');
  if (!allowsPlane) {
    const { lat: userLat, lon: userLon } = resolveOriginCoordinates(originContext);
    const originGeo = {
      lat: userLat,
      lon: userLon,
      countryCode: originContext?.country || (originContext?.federalState ? originContext.federalState.split('-')[0] : undefined),
      state: originContext?.federalState,
    };
    const maxDist = vehicles.includes('CAR') || vehicles.includes('TRAIN') ? 1200 : 750;
    return Array.from(resolved).filter((code) => {
      const ap = getAirportByIata(code);
      if (!ap) return false;
      const dist = calculateGeodesicDistanceKm(userLat, userLon, ap.lat, ap.lon);
      if (dist > maxDist) return false;
      const destGeo = {
        lat: ap.lat,
        lon: ap.lon,
        countryCode: ap.state ? ap.state.split('-')[0] : undefined,
        state: ap.state,
        code: ap.code,
        isHighSpeedRailConnected: ap.isHighSpeedRailConnected,
      };
      if (!isOverlandReachable(originGeo, destGeo)) return false;
      if (!vehicles.includes('CAR') && vehicles.includes('TRAIN') && dist > 900 && !ap.isHighSpeedRailConnected) return false;
      return true;
    });
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

  const cleanNorm = normalizeDestinationString(clean);

  // 1. Dynamic cache match (already resolved runtime entities)
  if (dynamicDestinationEntityCache.has(cleanNorm)) {
    const entity = dynamicDestinationEntityCache.get(cleanNorm)!;
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

        // Cache resolved entity for subsequent synchronous lookups
        dynamicDestinationEntityCache.set(cleanNorm, resolvedEntity);
        dynamicDestinationEntityCache.set(place.id, resolvedEntity);

        // Also cache individual parts of compound queries (e.g. "Hurghada & Rotes Meer" -> "rotes meer", "hurghada")
        if (clean.includes('&') || clean.toLowerCase().includes(' and ') || clean.toLowerCase().includes(' und ')) {
          const parts = clean.split(/[&+]|\b(?:and|und)\b/i);
          for (const p of parts) {
            const normP = normalizeDestinationString(p);
            if (normP.length >= 3) {
              dynamicDestinationEntityCache.set(normP, resolvedEntity);
            }
          }
        }

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
    // Fall through to offline resolver
  }

  // 4. Offline fallback via getDestinationEntity (commercial airport cities and countries)
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

  // 5. Strict rejection for unknown, non-flight, or fictitious places
  return { isValid: false };
}
