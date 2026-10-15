import { getCached, setCached } from '../cache/redis';
import { SchoolHoliday, PublicHoliday } from '../optimizer/types';

interface OpenHolidaysApiResponse {
  id: string;
  startDate: string;
  endDate: string;
  type: string;
  name: Array<{ language: string; text: string }>;
  subdivisions?: Array<{ code: string; shortName: string }>;
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
 * Fetch School Holidays dynamically via OpenHolidays API.
 * Cached in Redis with 30-day TTL.
 * Honest coverage: Returns empty array when provider lacks data. Never silently substitutes regional data.
 */
export async function getSchoolHolidays(
  stateCode: string,
  year: number = 2026
): Promise<SchoolHoliday[]> {
  const cleanCode = stateCode.trim().toUpperCase();
  const cacheKey = `holidays:v1:school:${cleanCode}:${year}`;

  const cached = await getCached<SchoolHoliday[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const country = cleanCode.split('-')[0] || 'DE';
  const openHolidaysUrl = process.env.OPEN_HOLIDAYS_API_URL || 'https://openholidaysapi.org';

  try {
    const url = `${openHolidaysUrl}/SchoolHolidays?countryIsoCode=${country}&subdivisionCode=${cleanCode}&validFrom=${year}-01-01&validTo=${year}-12-31`;

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
        const mapped: SchoolHoliday[] = data.map((item) => ({
          startDate: item.startDate,
          endDate: item.endDate,
          name: item.name?.[0]?.text || 'School Holiday',
          state: cleanCode,
        }));

        if (mapped.length > 0) {
          await setCached(cacheKey, mapped, TTL_30_DAYS);
          return mapped;
        }
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
  const cacheKey = `holidays:v1:public:${cleanCode}:${year}`;

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
        const mapped: PublicHoliday[] = data.map((item) => ({
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
    // Graceful fallback to empty
  }

  return [];
}
