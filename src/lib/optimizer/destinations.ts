import { POPULAR_DESTINATIONS } from './weather';
import { getAirportByIata } from '../airports/airport-service';
import { GLOBAL_PLACES_CATALOG, GlobalPlaceEntity } from '../geo/places-data';

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

// Build index of country localized names dynamically from GLOBAL_PLACES_CATALOG
const COUNTRY_LOCALIZED_NAMES: Record<string, Record<string, string>> = {};
for (const place of GLOBAL_PLACES_CATALOG) {
  if (place.category === 'country') {
    COUNTRY_LOCALIZED_NAMES[place.countryCode] = place.names;
  }
}

/**
 * Dynamically generated canonical destinations catalog derived from the unified global places taxonomy.
 * Eliminates static, duplicative arrays while providing full backwards compatibility.
 */
export const CANONICAL_DESTINATIONS: LocalizedDestinationEntity[] = GLOBAL_PLACES_CATALOG.map((place: GlobalPlaceEntity) => {
  const cNames = COUNTRY_LOCALIZED_NAMES[place.countryCode] || {
    en: place.countryName,
    de: place.countryName,
    fr: place.countryName,
    es: place.countryName,
    it: place.countryName,
  };

  return {
    id: place.id,
    category: place.category as DestinationCategory,
    code: place.airportCodes[0],
    parentRegionId: place.parentRegionId,
    aliases: place.aliases,
    airportCodes: place.airportCodes,
    countryCode: place.countryCode,
    names: place.names,
    countryNames: {
      en: cNames.en || place.countryName,
      de: cNames.de || place.countryName,
      fr: cNames.fr || place.countryName,
      es: cNames.es || place.countryName,
      it: cNames.it || place.countryName,
    },
  };
});

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

  // If one contains the other as a whole multi-word phrase
  if (tWords.length > 1 && source.includes(target)) return true;
  if (sWords.length > 1 && target.includes(source)) return true;

  // Single word must strictly match a complete token
  return sWords.includes(target) || tWords.includes(source);
}

/**
 * Finds a canonical destination entity by tag or query
 */
export function getDestinationEntity(
  queryOrTag: string,
  locale: string = 'de'
): LocalizedDestinationEntity | null {
  const clean = normalizeDestinationString(queryOrTag);
  if (!clean || clean.length < 2) return null;

  const upper = queryOrTag.trim().toUpperCase();

  // 1. Direct code or ID match
  const byCodeOrId = CANONICAL_DESTINATIONS.find(
    (d) =>
      d.id === clean ||
      d.code === upper ||
      d.airportCodes.includes(upper) ||
      d.countryCode === upper
  );
  if (byCodeOrId) return byCodeOrId;

  // 2. Exact name match across all locales (exact name takes highest priority)
  for (const dest of CANONICAL_DESTINATIONS) {
    for (const name of Object.values(dest.names)) {
      if (clean === normalizeDestinationString(name)) {
        return dest;
      }
    }
  }

  // 3. Substring match on entity names (e.g. "Mallorca" matching "Mallorca (Balearen)")
  for (const dest of CANONICAL_DESTINATIONS) {
    for (const name of Object.values(dest.names)) {
      const cleanName = normalizeDestinationString(name);
      if (isWordMatch(cleanName, clean)) {
        return dest;
      }
    }
  }

  // 4. Country entity exact match
  for (const dest of CANONICAL_DESTINATIONS) {
    if (dest.category === 'country') {
      for (const cName of Object.values(dest.countryNames)) {
        if (clean === normalizeDestinationString(cName)) {
          return dest;
        }
      }
    }
  }

  // 5. Explicit alias match
  for (const dest of CANONICAL_DESTINATIONS) {
    if (dest.aliases) {
      for (const alias of dest.aliases) {
        const cleanAlias = normalizeDestinationString(alias);
        if (clean === cleanAlias || isWordMatch(cleanAlias, clean)) {
          return dest;
        }
      }
    }
  }

  // 6. Fuzzy match across all canonical destinations
  const fuzzy = fuzzyMatchDestinationEntity(queryOrTag, locale);
  if (fuzzy) return fuzzy;

  return null;
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
 * Resilient fuzzy matching across canonical destination names and aliases
 */
export function fuzzyMatchDestinationEntity(
  query: string,
  _locale: string = 'de'
): LocalizedDestinationEntity | null {
  const clean = normalizeDestinationString(query);
  if (!clean || clean.length < 3) return null;

  let bestMatch: LocalizedDestinationEntity | null = null;
  let minDistance = Infinity;

  for (const dest of CANONICAL_DESTINATIONS) {
    const candidates = [
      dest.id,
      ...Object.values(dest.names),
      ...(dest.aliases || []),
      ...(dest.category === 'country' ? Object.values(dest.countryNames) : []),
    ];

    for (const cand of candidates) {
      const candNorm = normalizeDestinationString(cand);
      const dist = levenshteinDistance(clean, candNorm);
      const maxAllowed = clean.length <= 4 ? 1 : 2;

      if (dist <= maxAllowed && dist < minDistance) {
        minDistance = dist;
        bestMatch = dest;
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

  for (const existingTag of selectedDestinations) {
    const parent = getDestinationEntity(existingTag, locale);
    if (!parent || parent.id === child.id) continue;

    // 1. Explicit parentRegionId hierarchy
    if (child.parentRegionId && child.parentRegionId === parent.id) {
      return {
        isContained: true,
        parentTag: existingTag,
        parentEntity: parent,
        childEntity: child,
      };
    }

    // 2. Airport codes containment: If all airport codes of child are encompassed by parent region
    if (
      (parent.category === 'region' || parent.category === 'country') &&
      child.airportCodes.length > 0 &&
      child.airportCodes.every((code) => parent.airportCodes.includes(code))
    ) {
      return {
        isContained: true,
        parentTag: existingTag,
        parentEntity: parent,
        childEntity: child,
      };
    }

    // 3. Country-level containment
    if (parent.category === 'country' && child.countryCode === parent.countryCode) {
      return {
        isContained: true,
        parentTag: existingTag,
        parentEntity: parent,
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
 * STRICT: If destination tags are provided, returns ONLY the matching airports.
 * If none match, returns an EMPTY array (no unrequested fallback destinations).
 */
export function resolveDestinationCodes(destinationTags?: string[]): string[] {
  // If no destination filter was set by user, provide open discovery hubs
  if (!destinationTags || destinationTags.length === 0) {
    return ['PMI', 'AYT', 'HRG', 'HER', 'AGP', 'FAO', 'BCN', 'DJE'];
  }

  const resolved = new Set<string>();

  for (const tag of destinationTags) {
    const clean = normalizeDestinationString(tag);
    const upper = tag.trim().toUpperCase();

    // 1. Direct 3-letter IATA code
    if (upper.length === 3 && (POPULAR_DESTINATIONS[upper] || getAirportByIata(upper))) {
      resolved.add(upper);
      continue;
    }

    // 2. Canonical Destination Entity
    const entity = getDestinationEntity(tag);
    if (entity) {
      entity.airportCodes.forEach((code) => resolved.add(code));
      continue;
    }

    // 3. Check GLOBAL_PLACES_CATALOG
    for (const place of GLOBAL_PLACES_CATALOG) {
      const pName = normalizeDestinationString(place.name);
      const pId = place.id.toLowerCase();
      const aliasMatches = place.aliases.some((a) => isWordMatch(normalizeDestinationString(a), clean));
      const nameMatches = Object.values(place.names).some((n) => isWordMatch(normalizeDestinationString(n), clean));

      if (clean === pId || isWordMatch(pName, clean) || aliasMatches || nameMatches) {
        place.airportCodes.forEach((code) => resolved.add(code));
        break;
      }
    }
  }

  // STRICT FILTERING: Do NOT fall back to arbitrary destinations if user specified tags
  return Array.from(resolved);
}

/**
 * Strict pre-validation for destination inputs with regional containment detection.
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

  // 1. Check canonical destinations catalog (exact + alias + fuzzy)
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
    const airport = getAirportByIata(upper);
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

  // 3. Check GLOBAL_PLACES_CATALOG directly
  const locKey = (locale.slice(0, 2) as 'en' | 'de' | 'fr' | 'es' | 'it') || 'en';
  const cleanNorm = normalizeDestinationString(clean);
  for (const place of GLOBAL_PLACES_CATALOG) {
    const pName = normalizeDestinationString(place.name);
    const pId = place.id.toLowerCase();
    const aliasMatches = place.aliases.some((a) => isWordMatch(normalizeDestinationString(a), cleanNorm));
    const nameMatches = Object.values(place.names).some((n) => isWordMatch(normalizeDestinationString(n), cleanNorm));

    if (cleanNorm === pId || isWordMatch(pName, cleanNorm) || aliasMatches || nameMatches) {
      const localizedName = place.names[locKey] || place.name;
      const containment = checkRegionalContainment(
        {
          id: place.id,
          category: place.category as DestinationCategory,
          code: place.airportCodes[0],
          parentRegionId: place.parentRegionId,
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
        },
        selectedDestinations,
        locale
      );

      return {
        isValid: true,
        resolvedName: localizedName,
        category: place.category as DestinationCategory,
        categoryLabel: getLocalizedCategoryName(place.category as DestinationCategory, locale),
        airportCodes: place.airportCodes,
        isContained: containment.isContained,
        containment,
      };
    }
  }

  // 4. Strict rejection for unknown or fictitious places (e.g. "Mars")
  return { isValid: false };
}
