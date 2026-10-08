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

// Fallback baseline for DE-BW, DE-BY, DE-HE, etc. if OpenHolidays API is offline
const FALLBACK_SCHOOL_HOLIDAYS: Record<string, SchoolHoliday[]> = {
  'DE-BW': [
    { startDate: '2026-04-06', endDate: '2026-04-17', name: 'Osterferien', state: 'DE-BW' },
    { startDate: '2026-05-26', endDate: '2026-06-05', name: 'Pfingstferien', state: 'DE-BW' },
    { startDate: '2026-07-30', endDate: '2026-09-12', name: 'Sommerferien', state: 'DE-BW' },
    { startDate: '2026-10-26', endDate: '2026-10-30', name: 'Herbstferien', state: 'DE-BW' },
  ],
  'DE-BY': [
    { startDate: '2026-03-30', endDate: '2026-04-10', name: 'Osterferien', state: 'DE-BY' },
    { startDate: '2026-05-26', endDate: '2026-06-05', name: 'Pfingstferien', state: 'DE-BY' },
    { startDate: '2026-08-03', endDate: '2026-09-14', name: 'Sommerferien', state: 'DE-BY' },
    { startDate: '2026-11-02', endDate: '2026-11-06', name: 'Herbstferien', state: 'DE-BY' },
  ],
  'DE-HE': [
    { startDate: '2026-04-07', endDate: '2026-04-17', name: 'Osterferien', state: 'DE-HE' },
    { startDate: '2026-06-29', endDate: '2026-08-07', name: 'Sommerferien', state: 'DE-HE' },
    { startDate: '2026-10-05', endDate: '2026-10-17', name: 'Herbstferien', state: 'DE-HE' },
  ],
  'CH-BS': [
    { startDate: '2026-07-04', endDate: '2026-08-15', name: 'Sommerferien Basel', state: 'CH-BS' },
  ],
  'FR-67': [
    { startDate: '2026-07-04', endDate: '2026-08-31', name: 'Grandes Vacances Alsace', state: 'FR-67' },
  ],
};

const FALLBACK_PUBLIC_HOLIDAYS: Record<string, PublicHoliday[]> = {
  'DE-BW': [
    { date: '2026-01-01', name: 'Neujahr', state: 'DE-BW' },
    { date: '2026-01-06', name: 'Heilige Drei Könige', state: 'DE-BW' },
    { date: '2026-04-03', name: 'Karfreitag', state: 'DE-BW' },
    { date: '2026-04-06', name: 'Ostermontag', state: 'DE-BW' },
    { date: '2026-05-01', name: 'Tag der Arbeit', state: 'DE-BW' },
    { date: '2026-05-14', name: 'Christi Himmelfahrt', state: 'DE-BW' },
    { date: '2026-05-25', name: 'Pfingstmontag', state: 'DE-BW' },
    { date: '2026-06-04', name: 'Fronleichnam', state: 'DE-BW' },
    { date: '2026-10-03', name: 'Tag der Deutschen Einheit', state: 'DE-BW' },
    { date: '2026-11-01', name: 'Allerheiligen', state: 'DE-BW' },
    { date: '2026-12-25', name: '1. Weihnachtstag', state: 'DE-BW' },
    { date: '2026-12-26', name: '2. Weihnachtstag', state: 'DE-BW' },
  ],
};

const TTL_30_DAYS = 30 * 24 * 60 * 60;

/**
 * Fetch School Holidays with Redis Caching (30-day TTL)
 */
export async function getSchoolHolidays(
  stateCode: string,
  year: number = 2026
): Promise<SchoolHoliday[]> {
  const cacheKey = `holidays:school:${stateCode}:${year}`;
  const cached = await getCached<SchoolHoliday[]>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    // OpenHolidays API (Country DE, subdivision e.g. DE-BW)
    const country = stateCode.split('-')[0] || 'DE';
    const url = `https://openholidaysapi.org/SchoolHolidays?countryIsoCode=${country}&subdivisionCode=${stateCode}&validFrom=${year}-01-01&validTo=${year}-12-31`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data: OpenHolidaysApiResponse[] = await res.json();
      const mapped: SchoolHoliday[] = data.map((item) => ({
        startDate: item.startDate,
        endDate: item.endDate,
        name: item.name[0]?.text || 'School Holiday',
        state: stateCode,
      }));

      if (mapped.length > 0) {
        await setCached(cacheKey, mapped, TTL_30_DAYS);
        return mapped;
      }
    }
  } catch (err) {
    // Log and continue to fallback
    console.warn(`[OpenHolidays] School holiday fetch failed for ${stateCode}, using fallback.`);
  }

  // Graceful fallback
  const fallback = FALLBACK_SCHOOL_HOLIDAYS[stateCode] || FALLBACK_SCHOOL_HOLIDAYS['DE-BW'];
  await setCached(cacheKey, fallback, TTL_30_DAYS);
  return fallback;
}

/**
 * Fetch Public Holidays with Redis Caching (30-day TTL)
 */
export async function getPublicHolidays(
  stateCode: string,
  year: number = 2026
): Promise<PublicHoliday[]> {
  const cacheKey = `holidays:public:${stateCode}:${year}`;
  const cached = await getCached<PublicHoliday[]>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const country = stateCode.split('-')[0] || 'DE';
    const url = `https://openholidaysapi.org/PublicHolidays?countryIsoCode=${country}&subdivisionCode=${stateCode}&validFrom=${year}-01-01&validTo=${year}-12-31`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data: OpenHolidaysApiResponse[] = await res.json();
      const mapped: PublicHoliday[] = data.map((item) => ({
        date: item.startDate,
        name: item.name[0]?.text || 'Public Holiday',
        state: stateCode,
      }));

      if (mapped.length > 0) {
        await setCached(cacheKey, mapped, TTL_30_DAYS);
        return mapped;
      }
    }
  } catch (err) {
    console.warn(`[OpenHolidays] Public holiday fetch failed for ${stateCode}, using fallback.`);
  }

  const fallback = FALLBACK_PUBLIC_HOLIDAYS[stateCode] || FALLBACK_PUBLIC_HOLIDAYS['DE-BW'];
  await setCached(cacheKey, fallback, TTL_30_DAYS);
  return fallback;
}

