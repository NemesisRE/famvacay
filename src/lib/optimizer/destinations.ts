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
import {
  isOverlandReachable,
  classifyOverlandAccess,
  isOverlandVehicleInRange,
  maxGeodesicKmForMinutes,
  OVERLAND_MAX_GEODESIC_KM,
} from './vehicles';
import { getDestinationPoint, type DestinationPoint } from '../geo/destination-points';
import { SURFACE_DESTINATIONS } from '../geo/surface-destinations';
import {
  getAirportByIata,
  getAllCommercialAirports,
  getMajorAirportsForCountry,
  calculateGeodesicDistanceKm,
  getAirportPassengersMillions,
  type DynamicAirport,
} from '../airports/airport-service';
import { getCountryCodeFromSubdivision } from '../regions/subdivisions';

// Static import of the dependency-free advisory store: the former runtime require() of
// safety-service failed inside the Next.js bundle and silently treated every destination as safe.
export { isDestinationSafeForVacation } from '../safety/advisory-store';
import { isDestinationSafeForVacation } from '../safety/advisory-store';

import {
  ISLAND_OR_COASTAL_COUNTRIES,
  ISLAND_SUBDIVISIONS,
  COASTAL_KEYWORDS,
  ALPINE_KEYWORDS,
  MAJOR_CULTURE_CITIES,
  getDestinationVacationStyles,
} from './destination-styles';

export {
  ISLAND_OR_COASTAL_COUNTRIES,
  ISLAND_SUBDIVISIONS,
  COASTAL_KEYWORDS,
  ALPINE_KEYWORDS,
  MAJOR_CULTURE_CITIES,
  getDestinationVacationStyles,
};

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
  maxOverlandTravelMinutes?: number;
  longRangeStyles?: DestinationType[];
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

type OverlandVehicle = Exclude<TravelVehicle, 'PLANE'>;

// Minimum daytime temperature in the travel month for a long-haul destination to count as a beach trip
const LONG_HAUL_BEACH_MIN_DAY_TEMP = 22;

function resolveVehicles(originContext?: OriginContext): TravelVehicle[] {
  return originContext?.travelVehicles && originContext.travelVehicles.length > 0
    ? originContext.travelVehicles
    : originContext?.travelVehicle
    ? [originContext.travelVehicle]
    : ['PLANE'];
}

/**
 * Resolves the user's origin geographic coordinates from available context.
 * Overland trips start here (the home address), not at an airport.
 */
export function resolveOriginCoordinates(originContext?: OriginContext): { lat: number; lon: number } {
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
 * Largest straight-line distance any of the selected overland vehicles can cover, capped by
 * the user's maximum overland travel time when one is set. 0 when no overland vehicle is selected.
 */
export function resolveOverlandRangeKm(vehicles: TravelVehicle[], maxOverlandTravelMinutes?: number): number {
  let best = 0;
  for (const v of vehicles) {
    if (v === 'PLANE') continue;
    const hardCap =
      v === 'CAR'
        ? OVERLAND_MAX_GEODESIC_KM.CAR
        : v === 'TRAIN'
        ? OVERLAND_MAX_GEODESIC_KM.TRAIN_HIGH_SPEED
        : OVERLAND_MAX_GEODESIC_KM.BUS;
    const timeCap = maxOverlandTravelMinutes
      ? maxGeodesicKmForMinutes(v, maxOverlandTravelMinutes, v === 'TRAIN')
      : Infinity;
    best = Math.max(best, Math.min(hardCap, timeCap));
  }
  return best;
}

function isOverlandFeasible(
  vehicles: TravelVehicle[],
  dist: number,
  highSpeedRail: boolean,
  maxOverlandTravelMinutes?: number
): boolean {
  return vehicles.some((v) => {
    if (v === 'PLANE') return false;
    const vehicle = v as OverlandVehicle;
    if (!isOverlandVehicleInRange(vehicle, dist, highSpeedRail)) return false;
    if (!maxOverlandTravelMinutes) return true;
    return dist <= maxGeodesicKmForMinutes(vehicle, maxOverlandTravelMinutes, vehicle === 'TRAIN' && highSpeedRail);
  });
}

interface DiscoveryCandidate {
  code: string;
  dist: number;
  score: number;
  country: string;
  state?: string;
  lat: number;
  lon: number;
  isSurface: boolean;
  overlandOk: boolean;
  /** Real long-haul gateway (see isLongHaulGateway) - only these fill long-haul slots */
  longHaulGateway: boolean;
}

/**
 * A long-haul destination must be a real passenger gateway: >= 1M annual passengers (Wikidata),
 * or, without a recorded figure, the large airport of an island tourism nation (Maldives, Fiji,
 * Seychelles...). The airport dataset's own "large/major" flags also cover remote airstrips
 * (e.g. Corisco Island), which previously filled long-haul slots.
 */
function isLongHaulGateway(ap: DynamicAirport): boolean {
  const pax = getAirportPassengersMillions(ap.code);
  if (pax !== undefined) return pax >= 1;
  return ap.type === 'large_airport' && ISLAND_OR_COASTAL_COUNTRIES.has(ap.country);
}

export type WorldRegion =
  | 'EUROPE_MED'
  | 'MIDDLE_EAST'
  | 'AFRICA_INDIAN_OCEAN'
  | 'CENTRAL_ASIA'
  | 'SOUTH_ASIA'
  | 'SOUTHEAST_ASIA'
  | 'EAST_ASIA'
  | 'OCEANIA'
  | 'NORTH_AMERICA'
  | 'CARIBBEAN_CENTRAL_AMERICA'
  | 'SOUTH_AMERICA';

/**
 * Coarse world region of a coordinate, used to balance long-haul discovery. Purely geometric
 * (no country tables), so every airport in the index gets a region.
 */
export function getWorldRegion(lat: number, lon: number): WorldRegion {
  if (lon <= -150 || lon >= 150 || (lon >= 110 && lat <= -11)) return 'OCEANIA';
  if (lon < -30) {
    if (lat >= 24) return 'NORTH_AMERICA';
    if (lat >= 7 || (lon < -77 && lat >= 0)) return 'CARIBBEAN_CENTRAL_AMERICA';
    return 'SOUTH_AMERICA';
  }
  if (lon < 60) {
    if (lat >= 36 && lon < 45) return 'EUROPE_MED';
    if (lat >= 12 && lon >= 34) return 'MIDDLE_EAST';
    if (lat >= 30) return 'EUROPE_MED';
    return 'AFRICA_INDIAN_OCEAN';
  }
  if (lat >= 35 && lon < 90) return 'CENTRAL_ASIA';
  if (lon < 92) return lat >= 30 ? 'CENTRAL_ASIA' : 'SOUTH_ASIA';
  if (lat >= 22) return 'EAST_ASIA';
  if (lat > -11) return 'SOUTHEAST_ASIA';
  return 'OCEANIA';
}

/**
 * Long-haul (> 3500 km) slots are filled round-robin across world regions: each round every
 * region contributes its best-scoring eligible candidate. Pure score ordering let the region
 * with the strongest heuristic bonuses (Caribbean/Gulf beaches) take every slot, so flexible
 * searches never surfaced East/Southeast/Central Asia or Oceania at all.
 */
function selectAcrossWorldRegions(
  candidates: DiscoveryCandidate[],
  slots: number,
  trySelect: (c: DiscoveryCandidate) => boolean
): void {
  if (slots <= 0) return;
  const byRegion = new Map<WorldRegion, DiscoveryCandidate[]>();
  for (const c of candidates) {
    const region = getWorldRegion(c.lat, c.lon);
    const list = byRegion.get(region) || [];
    list.push(c);
    byRegion.set(region, list);
  }
  const regions = Array.from(byRegion.keys()).sort(
    (a, b) => byRegion.get(b)![0].score - byRegion.get(a)![0].score
  );
  let taken = 0;
  let progressed = true;
  while (taken < slots && progressed) {
    progressed = false;
    for (const region of regions) {
      if (taken >= slots) break;
      const list = byRegion.get(region)!;
      while (list.length > 0) {
        const c = list.shift()!;
        if (trySelect(c)) {
          taken++;
          progressed = true;
          break;
        }
      }
    }
  }
}

/**
 * Diversity-first selection for road/rail discovery. Airport-style selection (1 airport per
 * country for most countries, ranked by hub status) collapsed overland results to the same
 * 5-8 places every time; here countries take turns (best remaining candidate per country per
 * round), with per-country/per-state caps and a minimum spacing so two nodes on the same
 * stretch of coast (e.g. an airport town and the resort next to it) do not both use a slot.
 */
function selectOverlandDiverse(
  candidates: DiscoveryCandidate[],
  limit: number,
  alreadySelected: { lat: number; lon: number }[] = [],
  excludeCodes: Set<string> = new Set()
): string[] {
  const MAX_PER_COUNTRY = 4;
  const MAX_PER_STATE = 2;
  const MIN_SEPARATION_KM = 30;

  const pool = candidates
    .filter((c) => c.overlandOk && !excludeCodes.has(c.code))
    .sort((a, b) => b.score - a.score || a.dist - b.dist);

  const byCountry = new Map<string, DiscoveryCandidate[]>();
  for (const c of pool) {
    const list = byCountry.get(c.country) || [];
    list.push(c);
    byCountry.set(c.country, list);
  }
  const countryOrder = Array.from(byCountry.keys()).sort(
    (a, b) => byCountry.get(b)![0].score - byCountry.get(a)![0].score
  );

  const picked: string[] = [];
  const placed = [...alreadySelected];
  const perCountry = new Map<string, number>();
  const perState = new Map<string, number>();

  const isEligible = (c: DiscoveryCandidate) => {
    if ((perCountry.get(c.country) || 0) >= MAX_PER_COUNTRY) return false;
    if (c.state && (perState.get(c.state) || 0) >= MAX_PER_STATE) return false;
    return !placed.some((p) => calculateGeodesicDistanceKm(p.lat, p.lon, c.lat, c.lon) < MIN_SEPARATION_KM);
  };

  let progressed = true;
  while (picked.length < limit && progressed) {
    progressed = false;
    for (const country of countryOrder) {
      if (picked.length >= limit) break;
      const list = byCountry.get(country)!;
      const idx = list.findIndex(isEligible);
      if (idx < 0) continue;
      const [c] = list.splice(idx, 1);
      picked.push(c.code);
      placed.push({ lat: c.lat, lon: c.lon });
      perCountry.set(c.country, (perCountry.get(c.country) || 0) + 1);
      if (c.state) perState.set(c.state, (perState.get(c.state) || 0) + 1);
      progressed = true;
    }
  }
  return picked;
}

/**
 * Dynamic Destination Discovery Engine
 * Completely eliminates static, hardcoded airport lists or regional tables.
 * Discovers candidate destinations from the worldwide commercial airport database (4,000+ airports)
 * based on geodesic distance from origin, airport passenger readiness, topography/altitude, and climatological modeling.
 * Overland (car/train/bus) searches additionally index non-airport surface destinations and
 * select them without any airport-hub bias.
 */
export function discoverDestinationsDynamically(
  types: DestinationType[],
  originContext?: OriginContext
): string[] {
  const { lat: userLat, lon: userLon } = resolveOriginCoordinates(originContext);
  const originAirportSet = new Set((originContext?.originAirports || []).map((c) => c.toUpperCase()));
  const allAirports = getAllCommercialAirports();
  const candidates: DiscoveryCandidate[] = [];

  const isAll = types.includes('ALL');
  const vehicles = resolveVehicles(originContext);

  const allowsPlane = vehicles.includes('PLANE');
  const overlandVehicles = vehicles.filter((v) => v !== 'PLANE');
  const allowsOverland = overlandVehicles.length > 0;
  const allowsTrain = vehicles.includes('TRAIN');
  const maxOverlandMinutes = originContext?.maxOverlandTravelMinutes;
  const overlandRangeKm = resolveOverlandRangeKm(vehicles, maxOverlandMinutes);

  const minDistance = allowsPlane && !allowsOverland ? 180 : 40;
  const maxDistance = allowsPlane ? 20000 : overlandRangeKm;

  const originGeo = {
    lat: userLat,
    lon: userLon,
    countryCode: originContext?.country || (originContext?.federalState ? originContext.federalState.split('-')[0] : undefined),
    state: originContext?.federalState,
  };

  const startMonth = originContext?.earliestDate ? parseISO(originContext.earliestDate).getMonth() : 6;
  const endMonth = originContext?.latestDate ? parseISO(originContext.latestDate).getMonth() : startMonth;
  const repMonth = Math.round((startMonth + (endMonth < startMonth ? endMonth + 12 : endMonth)) / 2) % 12;

  const places: DestinationPoint[] = allAirports.map((ap) => getDestinationPoint(ap.code) || { ...ap, kind: 'AIRPORT' as const });
  if (allowsOverland) {
    for (const surface of SURFACE_DESTINATIONS) {
      const point = getDestinationPoint(surface.code);
      if (point) places.push(point);
    }
  }

  for (const ap of places) {
    const isSurface = ap.kind === 'SURFACE';
    if (!isSurface && originAirportSet.has(ap.code.toUpperCase())) continue;

    // Safety Assessment Filter (Amadeus Safe Place / Travel Advisory Level 1 & 2):
    // Flex search / open discovery must only surface safe, family-friendly destinations.
    if (!isDestinationSafeForVacation(isSurface ? '' : ap.code, ap.country)) continue;

    const dist = calculateGeodesicDistanceKm(userLat, userLon, ap.lat, ap.lon);
    if (dist < minDistance || dist > maxDistance) continue;

    const planeOk = allowsPlane && !isSurface && dist >= 180;
    let overlandOk = false;
    if (allowsOverland && dist <= overlandRangeKm) {
      const destGeo = {
        lat: ap.lat,
        lon: ap.lon,
        countryCode: ap.state ? ap.state.split('-')[0] : undefined,
        state: ap.state,
        code: ap.code,
        isHighSpeedRailConnected: ap.isHighSpeedRailConnected,
      };
      overlandOk =
        isOverlandReachable(originGeo, destGeo) &&
        classifyOverlandAccess(destGeo).access !== 'FLIGHT_ONLY' &&
        isOverlandFeasible(overlandVehicles, dist, Boolean(ap.isHighSpeedRailConnected), maxOverlandMinutes);
    }

    if (!planeOk && !overlandOk) continue;

    const altitudeMeters = (ap.altitude || 0) * 0.3048;
    const winterMonth = ap.lat >= 0 ? 0 : 6;
    const summerMonth = ap.lat >= 0 ? 6 : 0;
    const winterClimate = getEstimatedClimate(ap.code, winterMonth, { lat: ap.lat, lon: ap.lon });
    const summerClimate = getEstimatedClimate(ap.code, summerMonth, { lat: ap.lat, lon: ap.lon });

    const subInfo = ap.state ? iso.subdivision(ap.state) : null;
    const subName = subInfo?.name || '';
    const geoText = `${ap.name} ${ap.city} ${ap.country} ${subName}`;
    const textToSearch = `${geoText} ${ap.keywords || ''}`;

    const surfaceStyles = isSurface ? ap.surface?.styles || [] : [];

    const hasAlpineGeo =
      (altitudeMeters >= 900 && Math.abs(ap.lat) >= 28) ||
      ALPINE_KEYWORDS.test(textToSearch);
    const isAlpine = isSurface ? surfaceStyles.includes('ALPINE') : hasAlpineGeo && winterClimate.avgTempC <= 6;

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

    const travelClimate = getEstimatedClimate(ap.code, repMonth, { lat: ap.lat, lon: ap.lon });
    const travelDayTemp = travelClimate.maxTempC ?? travelClimate.avgTempC;

    const isBeach = isSurface
      ? surfaceStyles.includes('BEACH')
      : !isAlpine &&
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

    const isCity = isSurface
      ? surfaceStyles.includes('CITY')
      : Boolean(ap.isMajorHub) && (MAJOR_CULTURE_CITIES.test(textToSearch) || dist >= 300);
    const isNature = isSurface
      ? surfaceStyles.includes('NATURE')
      : isAlpine || (hasCoastalGeo && altitudeMeters < 250) || Math.abs(ap.lat) >= 55;
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
      const allowsLongRange = types.includes('LONGRANGE');
      // If user did NOT select LONGRANGE, long-range/exotic destinations (>3500 km or exotic)
      // must NOT be included in BEACH, CITY, NATURE, or ALPINE open discovery.
      const isExoticOrLongRange = dist >= 3500 || (isLongRange && dist >= 3500);
      if (!allowsLongRange && isExoticOrLongRange) {
        matchStyle = false;
      } else {
        if (types.includes('BEACH') && effectiveBeach) matchStyle = true;
        if ((types.includes('ALPINE') || types.includes('SKI')) && effectiveAlpine) matchStyle = true;
        if (types.includes('CITY') && isCity) matchStyle = true;
        if (types.includes('LONGRANGE') && isLongRange) {
          // Preferred kind of long-haul trip (e.g. only beach or only city long-haul)
          const prefs = originContext?.longRangeStyles || [];
          const matchesPreference =
            prefs.length === 0 ||
            // A long-haul beach trip needs beach weather in the travel month itself, not just in summer
            (prefs.includes('BEACH') && effectiveBeach && travelDayTemp >= LONG_HAUL_BEACH_MIN_DAY_TEMP) ||
            ((prefs.includes('ALPINE') || prefs.includes('SKI')) && effectiveAlpine) ||
            (prefs.includes('CITY') && isCity) ||
            (prefs.includes('NATURE') && isNature);
          if (matchesPreference) matchStyle = true;
        }
        if (types.includes('NATURE') && isNature) matchStyle = true;
      }
    }

    if (!matchStyle) continue;

    // Flight discovery prioritizes major passenger hubs with reliable airline service. That
    // bias is meaningless for a road trip, so overland-only candidates start level.
    let score = planeOk ? (ap.isMajorHub ? 60 : 25) : 40;

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

    if (overlandOk) {
      if (dist >= 60 && dist <= 850) {
        score += 45;
      } else if (dist <= 1400) {
        score += 32;
      } else {
        score += 20;
      }
      if (allowsTrain && ap.isHighSpeedRailConnected) {
        score += 25;
      }
    }

    if (planeOk) {
      // Popularity: real holiday gateways (Palma, Bangkok) over minor airfields
      const pax = getAirportPassengersMillions(ap.code) || 0;
      score += Math.min(20, Math.round(10 * Math.log10(1 + pax)));

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
      lat: ap.lat,
      lon: ap.lon,
      isSurface,
      overlandOk,
      longHaulGateway: !isSurface && isLongHaulGateway(ap),
    });
  }

  // Overland-only search: diversity-first selection across airports-as-places and surface nodes.
  if (!allowsPlane) {
    return selectOverlandDiverse(candidates, 36);
  }

  const airportCandidates = candidates.filter((c) => !c.isSurface);

  // Sort candidates by score descending, then distance ascending
  airportCandidates.sort((a, b) => b.score - a.score || a.dist - b.dist);

  // Geographic diversity deduplication:
  // - Maximum 1 airport per state/subdivision/island
  // - Maximum 4 airports for continental federations (US, CA, AU) across different states,
  //   3 for multi-state large nations (ES, IT, GR), and 1 for others
  // - Treat Canary Islands (ES with dist > 2500) and Azores/Madeira (PT with dist > 2200) as separate territories
  const selected: string[] = [];
  const seenCountryCount = new Map<string, number>();
  const seenSubdivision = new Set<string>();

  const canSelect = (c: DiscoveryCandidate) => {
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

  const longHaul = airportCandidates.filter((c) => c.dist > 3500 && c.longHaulGateway);

  if (isAll) {
    // 1. Core Regional & Mediterranean Corridor (dist <= 2500 km): Alpine, Med Coast & Culture
    const coreRegional = airportCandidates.filter((c) => c.dist <= 2500);
    for (const c of coreRegional) {
      canSelect(c);
      if (selected.length >= 14) break;
    }

    // 2. Extended Island & Sea Corridor (2500 < dist <= 3500 km): Canary Islands, Madeira, Azores, Cyprus, Red Sea
    const extendedIsland = airportCandidates.filter((c) => c.dist > 2500 && c.dist <= 3500);
    for (const c of extendedIsland) {
      canSelect(c);
      if (selected.length >= 19) break;
    }

    // 3. Long-range & Exotic Corridor (dist > 3500 km): balanced across world regions
    // (Middle East, Africa & Indian Ocean, South/Southeast/East/Central Asia, Oceania, Americas)
    selectAcrossWorldRegions(longHaul, 34 - selected.length, canSelect);
  } else if (types.includes('LONGRANGE')) {
    // Long-range requested (alone or combined with other styles): short/medium-haul matches by
    // score, long-haul slots balanced across world regions.
    const onlyLongRange = types.every((t) => t === 'LONGRANGE');
    if (!onlyLongRange) {
      for (const c of airportCandidates.filter((x) => x.dist <= 3500)) {
        canSelect(c);
        if (selected.length >= 14) break;
      }
    }
    selectAcrossWorldRegions(longHaul, 30 - selected.length, canSelect);
  } else {
    for (const c of airportCandidates) {
      canSelect(c);
      if (selected.length >= 28) break;
    }
  }

  // Mixed flight + overland search: add a diverse set of road/rail-only destinations on top
  // of the flight corridor picks, so a "plane or car" search is not airport-bound either.
  if (allowsOverland) {
    const selectedSet = new Set(selected);
    const anchors = candidates
      .filter((c) => selectedSet.has(c.code))
      .map((c) => ({ lat: c.lat, lon: c.lon }));
    const surfaceOnly = candidates.filter((c) => c.isSurface);
    selected.push(...selectOverlandDiverse(surfaceOnly, 10, anchors, selectedSet));
  }

  return selected;
}

/**
 * Surface (non-airport) destinations matching a user destination tag by resort name, coast /
 * region name, ISO subdivision or country, e.g. "Algarve", "Istria", "Mallorca", "Spain".
 */
function matchSurfaceDestinationsForTag(tag: string): string[] {
  const clean = normalizeDestinationString(tag);
  if (!clean || clean.length < 2) return [];
  const countryCode = clean.length === 2 ? clean.toUpperCase() : resolveCountryCode(clean);
  const matches: string[] = [];
  for (const s of SURFACE_DESTINATIONS) {
    const city = normalizeDestinationString(s.city);
    const region = normalizeDestinationString(s.region);
    const subName = normalizeDestinationString(iso.subdivision(s.state)?.name || '');
    const nodeCountry = s.state.split('-')[0];
    if (
      city === clean ||
      region === clean ||
      isWordMatch(region, clean) ||
      isWordMatch(city, clean) ||
      (subName && (subName === clean || isWordMatch(subName, clean))) ||
      s.state.toLowerCase() === clean.replace(/\s+/g, '-') ||
      (countryCode !== 'XX' && nodeCountry === countryCode)
    ) {
      matches.push(s.code);
    }
  }
  return matches;
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

  const vehicles = resolveVehicles(originContext);
  const allowsPlane = vehicles.includes('PLANE');
  const overlandVehicles = vehicles.filter((v) => v !== 'PLANE');
  if (overlandVehicles.length === 0) {
    return Array.from(resolved);
  }

  for (const tag of destinationTags) {
    matchSurfaceDestinationsForTag(tag).forEach((code) => resolved.add(code));
  }

  const { lat: userLat, lon: userLon } = resolveOriginCoordinates(originContext);
  const originGeo = {
    lat: userLat,
    lon: userLon,
    countryCode: originContext?.country || (originContext?.federalState ? originContext.federalState.split('-')[0] : undefined),
    state: originContext?.federalState,
  };
  const maxOverlandMinutes = originContext?.maxOverlandTravelMinutes;
  const overlandRangeKm = resolveOverlandRangeKm(vehicles, maxOverlandMinutes);

  return Array.from(resolved).filter((code) => {
    const point = getDestinationPoint(code);
    if (!point) return false;
    // Airports stay eligible for flights; only overland-only searches (or surface nodes,
    // which have no runway) must be physically reachable by road/rail.
    if (allowsPlane && point.kind === 'AIRPORT') return true;
    const dist = calculateGeodesicDistanceKm(userLat, userLon, point.lat, point.lon);
    if (dist > overlandRangeKm) return false;
    const destGeo = {
      lat: point.lat,
      lon: point.lon,
      countryCode: point.state ? point.state.split('-')[0] : undefined,
      state: point.state,
      code: point.code,
      isHighSpeedRailConnected: point.isHighSpeedRailConnected,
    };
    if (!isOverlandReachable(originGeo, destGeo)) return false;
    if (classifyOverlandAccess(destGeo).access === 'FLIGHT_ONLY') return false;
    return isOverlandFeasible(overlandVehicles, dist, Boolean(point.isHighSpeedRailConnected), maxOverlandMinutes);
  });
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
