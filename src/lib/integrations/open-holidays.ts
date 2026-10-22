import { getCached, setCached } from '../cache/redis';
import { SchoolHoliday, PublicHoliday } from '../optimizer/types';
import { getCalendarHolidays, resolveDateHolidaysRegion } from '../holidays/date-holidays-cache';
import { getTypicalSchoolHolidays, isCalendarYearComplete } from '../holidays/source-markets';

interface OpenHolidaysApiResponse {
  id: string;
  startDate: string;
  endDate: string;
  type: string;
  name: Array<{ language: string; text: string }>;
  nationwide?: boolean;
  subdivisions?: Array<{ code: string; shortName: string }>;
}

/**
 * Whether an OpenHolidays public holiday applies to the requested subdivision. The API's
 * subdivision filter also returns holidays of *finer* subdivisions (e.g. the Augsburg-only
 * Friedensfest for DE-BY), which would wrongly shorten PTO for the whole state; keep only
 * nationwide holidays and those declared for this subdivision or one of its parents.
 */
export function appliesToSubdivision(
  item: { nationwide?: boolean; subdivisions?: Array<{ code: string }> },
  subdivisionCode: string
): boolean {
  if (item.nationwide) return true;
  const subs = item.subdivisions || [];
  if (subs.length === 0) return item.nationwide !== false;
  const code = subdivisionCode.toUpperCase();
  return subs.some((sub) => {
    const subCode = (sub.code || '').toUpperCase();
    return subCode === code || code.startsWith(subCode + '-');
  });
}

interface NagerHolidayResponse {
  date: string;
  localName: string;
  name: string;
  countryCode: string;
  counties: string[] | null;
}

const TTL_30_DAYS = 30 * 24 * 60 * 60;

/**
 * Universal Holiday Coverage Status
 */
export interface HolidayCoverageStatus {
  countryCode: string;
  subdivisionCode?: string;
  hasSchoolHolidayCoverage: boolean;
  hasPublicHolidayCoverage: boolean;
  schoolHolidayProvider: string;
  publicHolidayProvider: string;
}

/**
 * ISO 3166-2 codes (as used by the airport and region data) whose OpenHolidays subdivision code
 * differs: France publishes by the current regions' short codes, Austria by letter codes.
 */
const OPEN_HOLIDAYS_SUBDIVISION_ALIASES: Record<string, string> = {
  'FR-ARA': 'FR-AR', 'FR-BFC': 'FR-BF', 'FR-BRE': 'FR-BT', 'FR-COR': 'FR-CO', 'FR-CVL': 'FR-CV',
  'FR-GES': 'FR-GE', 'FR-HDF': 'FR-HF', 'FR-IDF': 'FR-IF', 'FR-NAQ': 'FR-NA', 'FR-NOR': 'FR-NO',
  'FR-OCC': 'FR-OC', 'FR-PAC': 'FR-PC', 'FR-PDL': 'FR-PL',
  'AT-1': 'AT-BL', 'AT-2': 'AT-KÄ', 'AT-3': 'AT-NÖ', 'AT-4': 'AT-OÖ', 'AT-5': 'AT-SB',
  'AT-6': 'AT-SM', 'AT-7': 'AT-TI', 'AT-8': 'AT-VA', 'AT-9': 'AT-WI',
};

export function toOpenHolidaysSubdivision(stateCode: string): string {
  const code = stateCode.trim().toUpperCase();
  return OPEN_HOLIDAYS_SUBDIVISION_ALIASES[code] || code;
}

/**
 * Fetch School Holidays dynamically via OpenHolidays API.
 * Cached in Redis with 30-day TTL.
 * Honest coverage: Returns empty array when provider lacks data. Never silently substitutes regional data
 * unless the caller opts into estimates.
 *
 * Resolution: the subdivision query (with FR/AT code aliases); for countries published without
 * subdivisions (e.g. Belgium) the country-wide calendar. With `allowEstimates` (used for departure
 * airports' regions, where a missing calendar would otherwise look like "schools in session" and
 * grant a cross-border discount on every date) a year without a published summer break falls back
 * to the typical national calendar, marked as an estimate in the holiday name.
 */
export async function getSchoolHolidays(
  stateCode: string,
  year: number = 2026,
  options: { allowEstimates?: boolean } = {}
): Promise<SchoolHoliday[]> {
  const cleanCode = stateCode.trim().toUpperCase();
  const official = await getOfficialSchoolHolidays(cleanCode, year);
  if (!options.allowEstimates) return official;

  const inYear = official.filter((h) => h.endDate >= `${year}-01-01` && h.startDate <= `${year}-12-31`);
  if (isCalendarYearComplete(inYear.map((h) => ({ ...h, subdivisions: [] })), year)) return official;
  const typical = getTypicalSchoolHolidays(cleanCode.split('-')[0], year);
  if (typical.length === 0) return official;
  return typical.map((p) => ({
    startDate: p.startDate,
    endDate: p.endDate,
    name: 'Typical school holidays (estimate)',
    state: cleanCode,
  }));
}

async function getOfficialSchoolHolidays(cleanCode: string, year: number): Promise<SchoolHoliday[]> {
  const cacheKey = `holidays:v2:school:${cleanCode}:${year}`;

  const cached = await getCached<SchoolHoliday[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const country = cleanCode.split('-')[0] || 'DE';
  const subdivision = toOpenHolidaysSubdivision(cleanCode);
  const openHolidaysUrl = process.env.OPEN_HOLIDAYS_API_URL || 'https://openholidaysapi.org';

  try {
    const url = `${openHolidaysUrl}/SchoolHolidays?countryIsoCode=${country}&subdivisionCode=${encodeURIComponent(subdivision)}&validFrom=${year}-01-01&validTo=${year}-12-31`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data: OpenHolidaysApiResponse[] = await res.json();
      let mapped: SchoolHoliday[] = Array.isArray(data)
        ? data.map((item) => ({
            startDate: item.startDate,
            endDate: item.endDate,
            name: item.name?.[0]?.text || 'School Holiday',
            state: cleanCode,
          }))
        : [];

      // Countries published without subdivisions (Belgium) or keyed differently: use the
      // country-wide entries that apply nationwide or to this region
      if (mapped.length === 0) {
        const countryWide = await getCountrySchoolHolidays(country, year);
        mapped = countryWide
          .filter((p) => p.subdivisions.length === 0 || p.subdivisions.some((c) => c === subdivision || c.startsWith(subdivision + '-')))
          .map((p) => ({ startDate: p.startDate, endDate: p.endDate, name: 'School Holiday', state: cleanCode }));
      }

      if (mapped.length > 0) {
        await setCached(cacheKey, mapped, TTL_30_DAYS);
        return mapped;
      }
    }
  } catch (err) {
    console.warn(`[OpenHolidays] School holiday fetch failed or rate-limited for ${cleanCode}.`);
  }

  // Honest coverage: Return empty array. The UI will explicitly report no official school holiday coverage.
  return [];
}

/**
 * Fetch Public Holidays dynamically via OpenHolidays API with dynamic fallback to Nager.Date.
 * Cached in Redis with 30-day TTL.
 */
export async function getPublicHolidays(
  stateCode: string,
  year: number = 2026
): Promise<PublicHoliday[]> {
  const cleanCode = stateCode.trim().toUpperCase();
  const cacheKey = `holidays:v2:public:${cleanCode}:${year}`;

  const cached = await getCached<PublicHoliday[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const country = cleanCode.split('-')[0] || 'DE';
  const openHolidaysUrl = process.env.OPEN_HOLIDAYS_API_URL || 'https://openholidaysapi.org';

  // 1. Primary Engine: OpenHolidays API
  try {
    const url = `${openHolidaysUrl}/PublicHolidays?countryIsoCode=${country}&subdivisionCode=${cleanCode}&validFrom=${year}-01-01&validTo=${year}-12-31`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data: OpenHolidaysApiResponse[] = await res.json();
      if (Array.isArray(data)) {
        const mapped: PublicHoliday[] = data
          .filter((item) => !cleanCode.includes('-') || appliesToSubdivision(item, cleanCode))
          .map((item) => ({
            date: item.startDate,
            name: item.name?.[0]?.text || 'Public Holiday',
            state: cleanCode,
          }));

        if (mapped.length > 0) {
          await setCached(cacheKey, mapped, TTL_30_DAYS);
          return mapped;
        }
      }
    }
  } catch {
    // Proceed to secondary public holiday fallback
  }

  // 2. Secondary Engine Fallback: Nager.Date API (Worldwide Coverage)
  try {
    const nagerUrl = process.env.NAGER_DATE_API_URL || 'https://date.nager.at/api/v3';
    const url = `${nagerUrl}/PublicHolidays/${year}/${country}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data: NagerHolidayResponse[] = await res.json();
      if (Array.isArray(data)) {
        // Filter by subdivision counties if subdivision matches
        const filtered = data.filter((h) => {
          if (!h.counties || h.counties.length === 0) return true; // Nationwide
          return h.counties.includes(cleanCode);
        });

        const mapped: PublicHoliday[] = filtered.map((item) => ({
          date: item.date,
          name: item.localName || item.name || 'Public Holiday',
          state: cleanCode,
        }));

        if (mapped.length > 0) {
          await setCached(cacheKey, mapped, TTL_30_DAYS);
          return mapped;
        }
      }
    }
  } catch {
    // Proceed to offline regional calendar
  }

  // 3. Offline Engine: bundled date-holidays rule set (no network). Evaluates the regional
  // rules of the subdivision itself (e.g. Epiphany, Corpus Christi, All Saints for DE-BW), so
  // PTO math stays region-accurate even when both APIs are unreachable.
  const offline = getOfflinePublicHolidays(cleanCode, year);
  if (offline.length > 0) {
    // Shorter TTL so the authoritative providers are retried sooner.
    await setCached(cacheKey, offline, 24 * 60 * 60);
    return offline;
  }

  return [];
}

/**
 * Regional public holidays from the bundled date-holidays rules. Falls back to the national
 * calendar when date-holidays has no rules for the specific subdivision.
 */
export function getOfflinePublicHolidays(subdivisionCode: string, year: number): PublicHoliday[] {
  const cleanCode = subdivisionCode.trim().toUpperCase();
  const { country, state } = resolveDateHolidaysRegion(cleanCode);
  if (!country) return [];
  return getCalendarHolidays(country, year, state)
    .filter((h) => h.type === 'public')
    .map((h) => ({ date: h.date, name: h.name, state: cleanCode }));
}

export interface CountrySchoolHolidayPeriod {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  /** Subdivision codes the period applies to; empty = the whole country */
  subdivisions: string[];
}

/**
 * All school holiday periods of one country and year (every subdivision) in a single
 * OpenHolidays call, cached for 30 days. Used to model when foreign source markets travel.
 * Returns [] when the country is not covered (callers fall back to typical calendars).
 */
export async function getCountrySchoolHolidays(countryCode: string, year: number): Promise<CountrySchoolHolidayPeriod[]> {
  const country = countryCode.trim().toUpperCase();
  const cacheKey = `holidays:v1:school-country:${country}:${year}`;
  const cached = await getCached<CountrySchoolHolidayPeriod[]>(cacheKey);
  if (cached) return cached;

  const openHolidaysUrl = process.env.OPEN_HOLIDAYS_API_URL || 'https://openholidaysapi.org';
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(
      `${openHolidaysUrl}/SchoolHolidays?countryIsoCode=${country}&validFrom=${year}-01-01&validTo=${year}-12-31`,
      { signal: controller.signal, headers: { Accept: 'application/json' } }
    );
    clearTimeout(timeout);
    if (res.ok) {
      const data: OpenHolidaysApiResponse[] = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const periods = data.map((item) => ({
          startDate: item.startDate,
          endDate: item.endDate,
          subdivisions: item.nationwide ? [] : (item.subdivisions || []).map((s) => s.code),
        }));
        await setCached(cacheKey, periods, TTL_30_DAYS);
        return periods;
      }
    }
  } catch {
    console.warn(`[OpenHolidays] Country school holiday fetch failed for ${country} ${year}.`);
  }
  return [];
}
