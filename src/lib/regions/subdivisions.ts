import iso from 'iso-3166-2';

export interface AdministrativeSubdivision {
  code: string;
  name: string;
  country: string;
}

export interface CountryInfo {
  code: string;
  name: string;
  subdivisions: AdministrativeSubdivision[];
}

/**
 * Dynamically resolves administrative subdivisions for any country worldwide
 * via standard ISO 3166-2 package data.
 */
export function getCountrySubdivisions(countryCode: string): AdministrativeSubdivision[] {
  const code = countryCode.toUpperCase();
  const c = iso.country(code);
  if (!c || !c.sub) return [];
  return Object.entries(c.sub).map(([subCode, subInfo]: [string, any]) => ({
    code: subCode,
    name: subInfo.name,
    country: code,
  }));
}

/**
 * Resolves the localized country name in the requested locale using Intl.DisplayNames,
 * falling back to the standard ISO name if unavailable.
 */
export function getLocalizedCountryName(countryCode: string, locale = 'en'): string {
  if (!countryCode) return '';
  const code = countryCode.toUpperCase();
  try {
    const regionNames = new Intl.DisplayNames([locale], { type: 'region' });
    const name = regionNames.of(code);
    if (name) return name;
  } catch {
    // Fall back to standard ISO country name
  }
  const c = iso.country(code);
  return c?.name || code;
}

/**
 * Dynamically resolves country information and official subdivisions for any jurisdiction on Earth.
 */
export function getCountryInfo(countryCode: string, locale = 'en'): CountryInfo | null {
  const code = countryCode.toUpperCase();
  const c = iso.country(code);
  if (!c) return null;
  const subdivisions = getCountrySubdivisions(code);
  return {
    code,
    name: getLocalizedCountryName(code, locale),
    subdivisions,
  };
}

/**
 * Universal dynamic Proxy providing real-time CountryInfo for all 249 ISO countries worldwide
 * without requiring any static, country-specific hardcoding.
 */
export const COUNTRIES: Record<string, CountryInfo> = new Proxy(
  {},
  {
    get(_target, prop: string | symbol) {
      if (typeof prop !== 'string') return undefined;
      return getCountryInfo(prop) || undefined;
    },
    has(_target, prop: string | symbol) {
      if (typeof prop !== 'string') return false;
      return Boolean(iso.country(prop.toUpperCase()));
    },
    ownKeys(_target) {
      return Object.keys(iso.data).sort((a, b) => {
        const nameA = iso.data[a]?.name || a;
        const nameB = iso.data[b]?.name || b;
        return nameA.localeCompare(nameB);
      });
    },
    getOwnPropertyDescriptor(_target, prop: string | symbol) {
      if (typeof prop === 'string' && iso.data[prop.toUpperCase()]) {
        return {
          enumerable: true,
          configurable: true,
          value: getCountryInfo(prop),
        };
      }
      return undefined;
    },
  }
);

/**
 * Returns a static, deterministic country list using fixed ISO data.
 * Safe for server-side rendering and initial hydration without ICU version divergence.
 */
export function getDeterministicCountryList(): CountryInfo[] {
  return Object.keys(iso.data)
    .map((code) => {
      const c = iso.country(code.toUpperCase());
      if (!c) return null;
      const subdivisions = getCountrySubdivisions(code);
      return {
        code: code.toUpperCase(),
        name: c.name,
        subdivisions,
      };
    })
    .filter((c): c is CountryInfo => c !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Returns all ISO countries localized and sorted alphabetically for the given locale.
 */
export function getAllCountries(locale = 'en'): CountryInfo[] {
  return Object.keys(iso.data)
    .map((code) => getCountryInfo(code, locale))
    .filter((c): c is CountryInfo => c !== null)
    .sort((a, b) => a.name.localeCompare(b.name, locale));
}

/**
 * Dynamically extracts 2-letter ISO country code from standard ISO 3166-2 subdivision identifiers.
 */
export function getCountryCodeFromSubdivision(subdivisionCode: string): string {
  if (!subdivisionCode) return '';
  const prefix = subdivisionCode.split('-')[0]?.trim().toUpperCase();
  if (prefix && prefix.length === 2) {
    return prefix;
  }
  return subdivisionCode.slice(0, 2).toUpperCase() || '';
}
