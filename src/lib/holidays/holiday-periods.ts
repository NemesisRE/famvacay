import Holidays from 'date-holidays';
import { resolveDateHolidaysRegion } from './date-holidays-cache';

/**
 * Holiday periods of the home region for the "frequent blackouts" toggles: the public holidays of
 * the travellers' own country and region (date-holidays rules), not a fixed list of Christian
 * feasts - Eid al-Fitr in Saudi Arabia, Pesach and Rosh Hashanah in Israel, the Spring Festival in
 * China, Thanksgiving in the US, Easter in Germany.
 *
 * Holidays close to each other form one period (Good Friday to Easter Monday, the days of the
 * Spring Festival): a gap of up to MAX_GAP_DAYS days, i.e. across a weekend. Each period is
 * identified by its country and the date-holidays rule of its first holiday ("DE:easter -2",
 * "SA:30 Ramadan P4D"), which stays the same from year to year.
 */

const MAX_GAP_DAYS = 3;
const DAY_MS = 86_400_000;

export interface HolidayPeriod {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  /** All holiday names in the period, most days first */
  names: string[];
  /** Rules of all holidays in the period (a selection matches any of them) */
  rules: string[];
  days: number;
  /** Days covered by real holidays (substitute days left out) */
  holidayDays: number;
}

export interface HolidayBlackoutOption {
  id: string;
  name: string;
  /** Every holiday in it (for a tooltip) */
  names: string[];
  /** Several days long (shown first; single holidays come after) */
  multiDay: boolean;
  /** Its dates within the requested range */
  periods: { startDate: string; endDate: string }[];
}

interface RawHoliday {
  date: string;
  start: Date;
  end: Date;
  name: string;
  type: string;
  rule: string;
  substitute?: boolean;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: string, days: number): string {
  return isoDate(new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS));
}

const holidayCache = new Map<string, RawHoliday[]>();

function publicHolidays(region: string, year: number, locale: string): RawHoliday[] {
  const { country, state } = resolveDateHolidaysRegion(region);
  if (!country) return [];
  const key = `${country}|${state ?? ''}|${year}|${locale}`;
  const cached = holidayCache.get(key);
  if (cached) return cached;
  let list: RawHoliday[] = [];
  try {
    // Names in the user's language where date-holidays has them, otherwise English
    const options = { languages: [locale.slice(0, 2), 'en'] };
    const hd = state ? new Holidays(country, state, options) : new Holidays(country, options);
    list = ((hd.getHolidays(year) as RawHoliday[]) || []).filter((h) => h.type === 'public');
  } catch {
    list = [];
  }
  holidayCache.set(key, list);
  return list;
}

/** The holiday periods of a region (ISO 3166-1/-2, e.g. "DE-BY", "SA") in one calendar year. */
export function getHolidayPeriods(region: string, year: number, locale = 'en'): HolidayPeriod[] {
  const country = resolveDateHolidaysRegion(region).country;
  const days = publicHolidays(region, year, locale)
    .map((h) => {
      const startDate = String(h.date).slice(0, 10);
      const length = Math.max(1, Math.round((h.end.getTime() - h.start.getTime()) / DAY_MS));
      return { ...h, startDate, endDate: addDays(startDate, length - 1) };
    })
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  const periods: HolidayPeriod[] = [];
  let current: (typeof days)[number][] = [];
  const flush = () => {
    if (current.length === 0) return;
    // Substitute days extend a period but never name or identify it
    const named = current.filter((h) => !h.substitute);
    const lead = named[0] ?? current[0];
    // The holiday with the most days names the period (Nowruz, not the single day before it)
    const daysByName = new Map<string, number>();
    const holidayDaySet = new Set<string>();
    for (const h of named) {
      const length = Math.round((Date.parse(h.endDate) - Date.parse(h.startDate)) / DAY_MS) + 1;
      daysByName.set(h.name, (daysByName.get(h.name) ?? 0) + length);
      for (let i = 0; i < length; i++) holidayDaySet.add(addDays(h.startDate, i));
    }
    const names = [...daysByName.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
    const startDate = current[0].startDate;
    const endDate = current.reduce((max, h) => (h.endDate > max ? h.endDate : max), current[0].endDate);
    periods.push({
      id: `${country}:${lead.rule}`,
      name: names.length > 2 ? `${names.slice(0, 2).join(' & ')} …` : names.join(' & ') || lead.name,
      names: names.length > 0 ? names : [lead.name],
      startDate,
      endDate,
      rules: [...new Set(current.map((h) => h.rule))],
      days: Math.round((Date.parse(endDate) - Date.parse(startDate)) / DAY_MS) + 1,
      holidayDays: holidayDaySet.size,
    });
    current = [];
  };
  for (const h of days) {
    const lastEnd = current.length > 0 ? current.reduce((max, d) => (d.endDate > max ? d.endDate : max), current[0].endDate) : null;
    if (lastEnd && h.startDate > addDays(lastEnd, MAX_GAP_DAYS + 1)) flush();
    current.push(h);
  }
  flush();
  return periods;
}

/** Whether a selected id (country + rule) refers to this period. */
export function periodMatches(id: string, period: HolidayPeriod): boolean {
  const [country, ...ruleParts] = id.split(':');
  const rule = ruleParts.join(':');
  return period.id.startsWith(`${country}:`) && period.rules.some((r) => r === rule || r.startsWith(`${rule} `));
}

/**
 * The blackout toggles of a region with their dates in [from, to]: the periods that fall into the
 * range (plus the already selected ones), multi-day ones first, each in calendar order.
 */
export function getHolidayBlackoutOptions(
  region: string,
  from: string,
  to: string,
  locale = 'en',
  selected: string[] = []
): HolidayBlackoutOption[] {
  const firstYear = parseInt(from.slice(0, 4), 10);
  const lastYear = parseInt(to.slice(0, 4), 10);
  if (Number.isNaN(firstYear) || Number.isNaN(lastYear) || lastYear < firstYear) return [];
  const options = new Map<string, HolidayBlackoutOption & { order: string }>();
  for (let year = firstYear - 1; year <= lastYear + 1; year++) {
    for (const period of getHolidayPeriods(region, year, locale)) {
      let option = options.get(period.id);
      if (!option) {
        option = { id: period.id, name: period.name, names: period.names, multiDay: false, periods: [], order: period.startDate.slice(5) };
        options.set(period.id, option);
      }
      // Judged on the dates in the range: neighbouring years only help find the selected ones
      if (period.endDate >= from && period.startDate <= to) {
        option.periods.push({ startDate: period.startDate, endDate: period.endDate });
        option.multiDay ||= period.holidayDays > 1;
      }
    }
  }
  return [...options.values()]
    .filter((o) => o.periods.length > 0 || selected.includes(o.id))
    .sort((a, b) => Number(b.multiDay) - Number(a.multiDay) || a.order.localeCompare(b.order))
    .map(({ order: _order, ...option }) => option);
}

/** The dates of the selected holidays in [from, to] (for the search). */
export function resolveHolidayBlackouts(
  ids: string[],
  region: string,
  from: string,
  to: string,
  locale = 'en'
): { startDate: string; endDate: string; name: string }[] {
  const firstYear = parseInt(from.slice(0, 4), 10);
  const lastYear = parseInt(to.slice(0, 4), 10);
  if (ids.length === 0 || Number.isNaN(firstYear) || Number.isNaN(lastYear)) return [];
  const result: { startDate: string; endDate: string; name: string }[] = [];
  for (let year = firstYear - 1; year <= lastYear; year++) {
    for (const period of getHolidayPeriods(region, year, locale)) {
      if (period.endDate >= from && period.startDate <= to && ids.some((id) => periodMatches(id, period))) {
        result.push({ startDate: period.startDate, endDate: period.endDate, name: period.name });
      }
    }
  }
  return result.sort((a, b) => a.startDate.localeCompare(b.startDate));
}
