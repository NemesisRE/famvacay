/**
 * Ids of the "frequent blackouts" holiday toggles: "<country>:<date-holidays rule>" (e.g.
 * "SA:30 Ramadan P4D"). Client-safe: no holiday rules are evaluated here.
 */

/**
 * Selections saved before the holidays came from the home country (fixed Christian feasts) as ids
 * of the same holidays in that country; they match nothing where the country does not have them.
 */
const LEGACY_RULES: Record<string, string> = {
  easter: 'easter -2',
  ascension: 'easter 39',
  pentecost: 'easter 50',
  corpus_christi: 'easter 60',
  christmas_new_year: '12-25',
};

export function migrateHolidayBlackoutIds(ids: unknown, region: string): string[] {
  if (!Array.isArray(ids)) return [];
  const country = (region || '').split('-')[0].toUpperCase();
  const migrated = ids
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
    .map((id) => (id in LEGACY_RULES ? (/^[A-Z]{2}$/.test(country) ? `${country}:${LEGACY_RULES[id]}` : '') : id))
    .filter(Boolean);
  return [...new Set(migrated)];
}

/** Selected ids that belong to the home country (a change of country keeps the others stored, unused). */
export function holidayIdsForCountry(ids: string[], region: string): string[] {
  const country = (region || '').split('-')[0].toUpperCase();
  return ids.filter((id) => id.startsWith(`${country}:`));
}

export interface HolidayBlackoutOptionDto {
  id: string;
  name: string;
  names: string[];
  multiDay: boolean;
  periods: { startDate: string; endDate: string }[];
}

interface HolidayBlackoutResponse {
  options: HolidayBlackoutOptionDto[];
  blackouts: { startDate: string; endDate: string; name: string }[];
}

const requests = new Map<string, Promise<HolidayBlackoutResponse>>();

function fetchHolidayBlackouts(params: {
  region: string;
  locale: string;
  from?: string;
  to?: string;
  selected?: string[];
}): Promise<HolidayBlackoutResponse> {
  const query = new URLSearchParams({ region: params.region, locale: params.locale });
  if (params.from) query.set('from', params.from);
  if (params.to) query.set('to', params.to);
  if (params.selected?.length) query.set('selected', [...params.selected].sort().join(','));
  const key = query.toString();
  let request = requests.get(key);
  if (!request) {
    request = fetch(`/api/holidays/blackout-options?${key}`)
      .then((res) => (res.ok ? res.json() : {}))
      .then((data: { options?: unknown; blackouts?: unknown }) => ({
        options: Array.isArray(data.options) ? (data.options as HolidayBlackoutOptionDto[]) : [],
        blackouts: Array.isArray(data.blackouts) ? (data.blackouts as HolidayBlackoutResponse['blackouts']) : [],
      }))
      .catch(() => {
        requests.delete(key);
        return { options: [], blackouts: [] };
      });
    requests.set(key, request);
  }
  return request;
}

/** The holiday toggles of a home region with their dates in [from, to] (cached per request). */
export async function fetchHolidayBlackoutOptions(params: {
  region: string;
  locale: string;
  from?: string;
  to?: string;
  selected?: string[];
}): Promise<HolidayBlackoutOptionDto[]> {
  return (await fetchHolidayBlackouts(params)).options;
}

/** Date ranges of the selected holidays within [from, to], for the search. */
export async function resolveSelectedHolidayBlackouts(
  ids: string[],
  region: string,
  from: string,
  to: string,
  locale: string
): Promise<{ startDate: string; endDate: string; name: string }[]> {
  const own = holidayIdsForCountry(ids, region);
  if (own.length === 0) return [];
  return (await fetchHolidayBlackouts({ region, locale, from, to, selected: own })).blackouts;
}
