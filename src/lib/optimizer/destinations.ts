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
 * Standardized multilingual exonyms for international destination hubs
 */
const MAJOR_CITY_EXONYMS: Record<
  string,
  { id: string; code: string; names: Record<string, string>; aliases: string[] }
> = {
  athens: {
    id: 'athens',
    code: 'ATH',
    names: { en: 'Athens', de: 'Athen', fr: 'Athènes', es: 'Atenas', it: 'Atene' },
    aliases: ['athen', 'athens', 'athènes', 'atene', 'atenas', 'athene', 'aten'],
  },
  munich: {
    id: 'munich',
    code: 'MUC',
    names: { en: 'Munich', de: 'München', fr: 'Munich', es: 'Múnich', it: 'Monaco di Baviera' },
    aliases: ['munich', 'münchen', 'munchen', 'múnich', 'monaco di baviera'],
  },
  vienna: {
    id: 'vienna',
    code: 'VIE',
    names: { en: 'Vienna', de: 'Wien', fr: 'Vienne', es: 'Viena', it: 'Vienna' },
    aliases: ['vienna', 'wien', 'vienne', 'viena'],
  },
  rome: {
    id: 'rome',
    code: 'FCO',
    names: { en: 'Rome', de: 'Rom', fr: 'Rome', es: 'Roma', it: 'Roma' },
    aliases: ['rome', 'rom', 'roma', 'romme'],
  },
  prague: {
    id: 'prague',
    code: 'PRG',
    names: { en: 'Prague', de: 'Prag', fr: 'Prague', es: 'Praga', it: 'Praga' },
    aliases: ['prague', 'prag', 'praha', 'praga'],
  },
  lisbon: {
    id: 'lisbon',
    code: 'LIS',
    names: { en: 'Lisbon', de: 'Lissabon', fr: 'Lisbonne', es: 'Lisboa', it: 'Lisbona' },
    aliases: ['lisbon', 'lissabon', 'lisbonne', 'lisboa', 'lisbona'],
  },
};

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

  // 3. International city exonyms
  for (const exonym of Object.values(MAJOR_CITY_EXONYMS)) {
    if (
      exonym.aliases.includes(clean) ||
      Object.values(exonym.names).some((n) => normalizeDestinationString(n) === clean)
    ) {
      const airport = getAirportByIata(exonym.code);
      const cCode = airport ? resolveCountryCode(airport.country) : 'XX';
      const cNames = getLocalizedCountryNames(cCode, airport?.country || '');
      const ent: LocalizedDestinationEntity = {
        id: exonym.id,
        category: 'city',
        code: exonym.code,
        airportCodes: [exonym.code],
        countryCode: cCode,
        names: {
          en: exonym.names.en || exonym.id,
          de: exonym.names.de || exonym.id,
          fr: exonym.names.fr || exonym.id,
          es: exonym.names.es || exonym.id,
          it: exonym.names.it || exonym.id,
        },
        countryNames: cNames,
      };
      dynamicDestinationEntityCache.set(clean, ent);
      return ent;
    }
  }

  // 4. Country match via dynamic ISO package
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

  // 5. Special region corridors: Red Sea / Rotes Meer
  if (
    clean === 'rotes meer' ||
    clean === 'red sea' ||
    clean === 'hurghada & rotes meer' ||
    clean === 'hurghada rotes meer' ||
    clean === 'hurghada red sea'
  ) {
    const redSeaEntity: LocalizedDestinationEntity = {
      id: 'red_sea',
      category: 'region',
      code: 'HRG',
      airportCodes: ['HRG', 'SSH', 'RMF'],
      countryCode: 'EG',
      aliases: ['hurghada', 'red sea', 'rotes meer', 'hurghada & rotes meer'],
      names: {
        en: 'Hurghada & Red Sea',
        de: 'Hurghada & Rotes Meer',
        fr: 'Hurghada et Mer Rouge',
        es: 'Hurgada y Mar Rojo',
        it: 'Hurghada e Mar Rosso',
      },
      countryNames: getLocalizedCountryNames('EG', 'Egypt'),
    };
    dynamicDestinationEntityCache.set(clean, redSeaEntity);
    return redSeaEntity;
  }

  // 6. Island / archipelago: Mallorca (Balearen)
  if (clean.includes('mallorca') || clean.includes('majorca')) {
    const mallorcaEntity: LocalizedDestinationEntity = {
      id: 'mallorca',
      category: 'region',
      code: 'PMI',
      airportCodes: ['PMI'],
      countryCode: 'ES',
      aliases: ['mallorca', 'majorca', 'palma'],
      names: {
        en: 'Mallorca (Balearic Islands)',
        de: 'Mallorca (Balearen)',
        fr: 'Majorque (Îles Baléares)',
        es: 'Mallorca (Islas Baleares)',
        it: 'Maiorca (Isole Baleari)',
      },
      countryNames: getLocalizedCountryNames('ES', 'Spain'),
    };
    dynamicDestinationEntityCache.set(clean, mallorcaEntity);
    return mallorcaEntity;
  }

  // 7. Commercial airport city matching across all worldwide airports
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
    const ent = airportToDestinationEntity(best.code, best.city, best.country, locale);
    dynamicDestinationEntityCache.set(clean, ent);
    return ent;
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

  // 1. Resilient fuzzy match against major international city exonyms
  for (const exonym of Object.values(MAJOR_CITY_EXONYMS)) {
    for (const cand of exonym.aliases) {
      const dist = levenshteinDistance(clean, cand);
      const maxAllowed = clean.length <= 4 ? 1 : 2;
      if (dist <= maxAllowed) {
        return getDestinationEntity(exonym.id, locale);
      }
    }
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

    // Special travel corridor matching
    if (clean.includes('rot') && clean.includes('meer') || clean.includes('red') && clean.includes('sea')) {
      ['HRG', 'SSH', 'RMF'].forEach((c) => resolved.add(c));
      continue;
    }

    if (clean.includes('mallorca') || clean.includes('majorca')) {
      resolved.add('PMI');
      continue;
    }

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
        let localizedName = place.names?.[locKey] || place.name;

        // Ensure localized name formatting matches user region conventions (e.g. Mallorca (Balearen))
        const cleanNorm = normalizeDestinationString(clean);
        if (cleanNorm === 'mallorca' && locale === 'de') {
          localizedName = 'Mallorca (Balearen)';
        }

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
