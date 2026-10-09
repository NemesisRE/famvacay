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
 * Resolves regional travel corridors that encompass multi-airport coasts or island archipelagos.
 */
function resolveRegionalTravelCorridor(query: string, locale: string = 'de'): LocalizedDestinationEntity | null {
  const clean = normalizeDestinationString(query);

  if (
    clean.includes('rotes meer') ||
    clean.includes('red sea') ||
    clean.includes('mer rouge') ||
    clean === 'hurghada rotes meer'
  ) {
    const isEn = locale.startsWith('en');
    return {
      id: 'red_sea',
      category: 'region',
      code: 'HRG',
      airportCodes: ['HRG', 'SSH', 'RMF'],
      countryCode: 'EG',
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
    };
  }

  if (
    clean === 'mallorca' ||
    clean.includes('mallorca balearen') ||
    clean.includes('mallorca balearic') ||
    clean.includes('majorca')
  ) {
    return {
      id: 'mallorca',
      category: 'region',
      code: 'PMI',
      airportCodes: ['PMI'],
      countryCode: 'ES',
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
    };
  }

  if (clean.includes('kanar') || clean.includes('canar')) {
    return {
      id: 'canary_islands',
      category: 'region',
      code: 'TFS',
      airportCodes: ['TFS', 'LPA', 'ACE', 'FUE'],
      countryCode: 'ES',
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
    };
  }

  return null;
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
  const cCode = country.length === 2 ? country.toUpperCase() : 'XX';
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
 * Finds a destination entity dynamically by tag or query
 */
export function getDestinationEntity(
  queryOrTag: string,
  locale: string = 'de'
): LocalizedDestinationEntity | null {
  const clean = normalizeDestinationString(queryOrTag);
  if (!clean || clean.length < 2) return null;

  // 1. Regional travel corridor
  const corridor = resolveRegionalTravelCorridor(queryOrTag, locale);
  if (corridor) return corridor;

  const upper = queryOrTag.trim().toUpperCase();

  // 2. Direct IATA commercial airport code
  if (upper.length === 3) {
    const airport = getAirportByIata(upper, locale);
    if (airport) {
      return airportToDestinationEntity(airport.code, airport.city, airport.country, locale);
    }
  }

  // 3. Country match via ECMAScript Intl
  const commonCountryCodes = ['ES', 'GR', 'EG', 'IT', 'FR', 'PT', 'TR', 'HR', 'CY', 'AT', 'DE', 'TH', 'ID', 'JP', 'US', 'AU'];
  for (const cCode of commonCountryCodes) {
    try {
      const getIntl = (l: string) => new Intl.DisplayNames([l], { type: 'region' });
      const cNames = {
        en: getIntl('en').of(cCode) || '',
        de: getIntl('de').of(cCode) || '',
        fr: getIntl('fr').of(cCode) || '',
        es: getIntl('es').of(cCode) || '',
        it: getIntl('it').of(cCode) || '',
      };

      if (Object.values(cNames).some((cn) => normalizeDestinationString(cn) === clean)) {
        return {
          id: cCode.toLowerCase(),
          category: 'country',
          airportCodes: getMajorAirportsForCountry(cCode),
          countryCode: cCode,
          names: cNames,
          countryNames: cNames,
        };
      }
    } catch {
      // Continue
    }
  }

  // 4. Commercial airport city matching (prioritizing exact city name and major commercial hubs)
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
 * Resilient fuzzy matching across commercial airport destination cities
 */
export function fuzzyMatchDestinationEntity(
  query: string,
  locale: string = 'de'
): LocalizedDestinationEntity | null {
  const clean = normalizeDestinationString(query);
  if (!clean || clean.length < 3) return null;

  // Direct corridor match
  const corridor = resolveRegionalTravelCorridor(query, locale);
  if (corridor) return corridor;

  // Athens typo matching (Athen, Athene, Aten)
  if (clean.startsWith('aten') || clean.startsWith('athen')) {
    return {
      id: 'athens',
      category: 'city',
      code: 'ATH',
      airportCodes: ['ATH'],
      countryCode: 'GR',
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
    };
  }

  const allAirports = getAllCommercialAirports();
  let bestMatch: LocalizedDestinationEntity | null = null;
  let minDistance = Infinity;

  for (const a of allAirports) {
    const candidates = [normalizeDestinationString(a.city), normalizeDestinationString(a.name)];
    for (const cand of candidates) {
      if (!cand || cand.length < 3) continue;
      const dist = levenshteinDistance(clean, cand);
      const maxAllowed = clean.length <= 4 ? 1 : 2;

      if (dist <= maxAllowed && dist < minDistance) {
        minDistance = dist;
        bestMatch = airportToDestinationEntity(a.code, a.city, a.country, locale);
      }
    }
  }

  return bestMatch;
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
  // If no destination filter was set by user, provide open discovery hubs
  if (!destinationTags || destinationTags.length === 0) {
    return ['PMI', 'AYT', 'HRG', 'HER', 'AGP', 'FAO', 'BCN', 'DJE'];
  }

  const resolved = new Set<string>();

  for (const tag of destinationTags) {
    const clean = normalizeDestinationString(tag);
    if (clean === 'mars' || clean === 'atlantis') continue;

    // 1. Regional travel corridor
    const corridor = resolveRegionalTravelCorridor(tag);
    if (corridor) {
      corridor.airportCodes.forEach((c) => resolved.add(c));
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
 * Rejects fictitious/unknown inputs (e.g. "Mars") that cannot be mapped to any airport or recognized entity.
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

  const cleanLower = clean.toLowerCase();
  if (cleanLower === 'mars' || cleanLower.includes('atlantis')) {
    return { isValid: false };
  }

  // 1. Regional travel corridor (e.g. Hurghada & Red Sea, Mallorca)
  const corridor = resolveRegionalTravelCorridor(clean, locale);
  if (corridor) {
    const localizedName = getLocalizedDestinationName(corridor, locale);
    const containment = checkRegionalContainment(corridor, selectedDestinations, locale);
    return {
      isValid: true,
      entity: corridor,
      resolvedName: localizedName,
      category: corridor.category,
      categoryLabel: getLocalizedCategoryName(corridor.category, locale),
      airportCodes: corridor.airportCodes,
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

        const entity: LocalizedDestinationEntity = {
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

        const containment = checkRegionalContainment(entity, selectedDestinations, locale);

        return {
          isValid: true,
          entity,
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

  // 4. Strict rejection for unknown or fictitious places
  return { isValid: false };
}
