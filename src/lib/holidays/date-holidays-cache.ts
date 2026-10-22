import Holidays from 'date-holidays';

export interface CachedCalendarHoliday {
  date: string; // YYYY-MM-DD (local calendar date of the holiday start)
  name: string;
  type: string; // 'public' | 'bank' | 'school' | 'optional' | 'observance'
}

const holidayListCache = new Map<string, CachedCalendarHoliday[]>();
const supportedStatesCache = new Map<string, Set<string>>();

/**
 * Splits an ISO 3166-2 subdivision code ("DE-BW", "AT-9", "ES-CT") into the country and
 * state identifiers date-holidays expects ("DE" + "BW"). Returns no state when date-holidays
 * has no rules for that subdivision, so callers get the nationwide calendar instead of none.
 */
export function resolveDateHolidaysRegion(subdivisionCode: string): { country: string; state?: string } {
  const clean = (subdivisionCode || '').trim().toUpperCase();
  const [country, ...rest] = clean.split('-');
  const stateSuffix = rest.join('-');
  if (!country || country.length !== 2) return { country: '' };
  if (!stateSuffix) return { country };

  let supported = supportedStatesCache.get(country);
  if (!supported) {
    supported = new Set<string>();
    try {
      const states = new Holidays().getStates(country) as Record<string, string> | undefined;
      for (const code of Object.keys(states || {})) supported.add(code.toUpperCase());
    } catch {
      // Unknown country: leave the set empty
    }
    supportedStatesCache.set(country, supported);
  }
  return supported.has(stateSuffix) ? { country, state: stateSuffix } : { country };
}

/**
 * Returns the date-holidays calendar for one country (optionally one subdivision) and year.
 * Building a Holidays instance and evaluating its rules is expensive (moment-timezone parsing),
 * and the optimizer asks for the same country/year once per candidate window, so results are
 * cached for the lifetime of the process.
 */
export function getCalendarHolidays(
  countryCode: string,
  year: number,
  stateCode?: string
): CachedCalendarHoliday[] {
  const country = (countryCode || '').trim().toUpperCase();
  if (country.length !== 2) return [];
  const state = stateCode ? stateCode.trim().toUpperCase() : '';
  const key = `${country}|${state}|${year}`;
  const cached = holidayListCache.get(key);
  if (cached) return cached;

  let list: CachedCalendarHoliday[] = [];
  try {
    const hd = state ? new Holidays(country, state) : new Holidays(country);
    const raw = hd.getHolidays(year);
    if (Array.isArray(raw)) {
      list = raw.map((h: any) => ({
        date: String(h.date || '').slice(0, 10),
        name: String(h.name || ''),
        type: String(h.type || 'public'),
      }));
    }
  } catch {
    list = [];
  }
  holidayListCache.set(key, list);
  return list;
}
