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
 * Dynamically resolves country information and official subdivisions for any jurisdiction on Earth.
 */
export function getCountryInfo(countryCode: string): CountryInfo | null {
  const code = countryCode.toUpperCase();
  const c = iso.country(code);
  if (!c) return null;
  const subdivisions = getCountrySubdivisions(code);
  return {
    code,
    name: c.name,
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
  }
);

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
