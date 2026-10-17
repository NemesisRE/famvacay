import countries from 'i18n-iso-countries';
import deCountries from 'i18n-iso-countries/langs/de.json';
import enCountries from 'i18n-iso-countries/langs/en.json';
import frCountries from 'i18n-iso-countries/langs/fr.json';
import esCountries from 'i18n-iso-countries/langs/es.json';
import itCountries from 'i18n-iso-countries/langs/it.json';
import iso from 'iso-3166-2';
import { POPULAR_DESTINATIONS } from './weather';
import {
  getAirportByIata,
  getAllCommercialAirports,
  getMajorAirportsForCountry,
} from '../airports/airport-service';

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
    .replace(/[_\-\/()&]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks if two strings match via full equality, whole-word phrase match,
 * or shared significant word tokens (length >= 4).
 */
function isWordMatch(source: string, target: string): boolean {
  if (source === target) return true;
  const sWords = source.split(/\s+/).filter(Boolean);
  const tWords = target.split(/\s+/).filter(Boolean);

  if (tWords.length > 1 && source.includes(target)) return true;
  if (sWords.length > 1 && target.includes(source)) return true;

  if (sWords.includes(target) || tWords.includes(source)) return true;

  // Check if they share any significant word token (>= 4 chars)
  for (const sw of sWords) {
    if (sw.length >= 4 && tWords.includes(sw)) {
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
  let bestScore = Infinity;

  for (const a of allAirports) {
    if (!a.code || !a.city) continue;
    const cLow = normalizeDestinationString(a.city);
    const nLow = normalizeDestinationString(a.name);
    const dist = Math.min(wordLevenshtein(clean, cLow), wordLevenshtein(clean, nLow));
    const maxAllowed = clean.length <= 4 ? 2 : 3;
    if (dist > maxAllowed) continue;

    const score = dist - (a.isMajorHub ? 1.5 : 0);
    if (score < bestScore) {
      bestScore = score;
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

/**
 * Resolves user destination tags into valid candidate destination airport codes.
 * Dynamically queries commercial passenger airport catalogs and runtime country indices.
 * STRICT: If destination tags are provided, returns ONLY the matching airports.
 */
export function resolveDestinationCodes(destinationTags?: string[]): string[] {
  // If no destination filter was set by user, provide open discovery hubs dynamically
  if (!destinationTags || destinationTags.length === 0) {
    const commercialAirports = getAllCommercialAirports();
    const discoveryVacationHubs = ['PMI', 'AYT', 'HRG', 'HER', 'AGP', 'FAO', 'BCN', 'DJE'];
    const majorHubs = commercialAirports.filter((a) => a.isMajorHub).map((a) => a.code);
    const combined = Array.from(new Set([...discoveryVacationHubs, ...majorHubs]));
    return combined.slice(0, 10);
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
