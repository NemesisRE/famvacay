import Holidays from 'date-holidays';
import { getCountrySchoolHolidays, getSchoolHolidays, toOpenHolidaysSubdivision } from '@/lib/integrations/open-holidays';
import { isCalendarYearComplete } from './source-markets';
import { resolveDateHolidaysRegion } from './date-holidays-cache';

/**
 * Day-by-day holiday calendars for the "Calendar" results tab:
 * - country view: how many school regions of the home country are on holiday each day (like the
 *   ADAC "Feriendichte" chart, for any country OpenHolidays covers), plus nationwide public holidays
 * - personal view: the school holidays of the children's school regions and the public holidays of
 *   the home region; without school children every day is possible and rated by all regions off
 * Years without published school holidays are reported as unknown, never as "no holidays".
 */

const DAY_MS = 86_400_000;

function eachDay(from: string, to: string): string[] {
  const days: string[] = [];
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`); t += DAY_MS) {
    days.push(new Date(t).toISOString().slice(0, 10));
  }
  return days;
}

function yearsBetween(from: string, to: string): number[] {
  const years: number[] = [];
  for (let y = parseInt(from.slice(0, 4), 10); y <= parseInt(to.slice(0, 4), 10); y++) years.push(y);
  return years;
}

/** Public holidays of a region (ISO 3166-1/-2) by date, named in the user's language or English. */
function publicHolidayNames(region: string, years: number[], locale: string): Map<string, string> {
  const { country, state } = resolveDateHolidaysRegion(region);
  const names = new Map<string, string>();
  if (!country) return names;
  try {
    const options = { languages: [locale.slice(0, 2), 'en'] };
    const hd = state ? new Holidays(country, state, options) : new Holidays(country, options);
    for (const year of years) {
      for (const h of (hd.getHolidays(year) as { date: string; start: Date; end: Date; name: string; type: string; substitute?: boolean }[]) || []) {
        if (h.type !== 'public') continue;
        const length = Math.max(1, Math.round((h.end.getTime() - h.start.getTime()) / DAY_MS));
        const start = String(h.date).slice(0, 10);
        for (let i = 0; i < length; i++) {
          const day = new Date(Date.parse(`${start}T00:00:00Z`) + i * DAY_MS).toISOString().slice(0, 10);
          if (!names.has(day)) names.set(day, h.name);
        }
      }
    }
  } catch {
    // Country without holiday rules: no public holidays shown
  }
  return names;
}

export interface CountryCalendarDay {
  date: string;
  /** School regions on holiday; null = no published school holidays for that year */
  regionsOnHoliday: number | null;
  publicHoliday?: string;
}

export interface CountryCalendar {
  country: string;
  /** School regions in the data (the share's denominator); 0 = no school holiday data at all */
  totalRegions: number;
  days: CountryCalendarDay[];
}

interface CountryCalendarData extends CountryCalendar {
  /** OpenHolidays region codes of the data, and which of them are on holiday per day */
  regionCodes: string[];
  activeByDate: Map<string, Set<string> | 'all'>;
}

export async function getCountryHolidayCalendar(country: string, from: string, to: string, locale: string): Promise<CountryCalendar> {
  const { regionCodes: _codes, activeByDate: _active, ...calendar } = await buildCountryCalendar(country, from, to, locale);
  return calendar;
}

async function buildCountryCalendar(country: string, from: string, to: string, locale: string): Promise<CountryCalendarData> {
  const code = country.toUpperCase();
  const years = yearsBetween(from, to);
  const periodsByYear = await Promise.all(years.map((y) => getCountrySchoolHolidays(code, y)));
  const regions = new Set<string>();
  for (const periods of periodsByYear) for (const p of periods) for (const s of p.subdivisions) regions.add(s);
  // A year counts once most regions have their full calendar: one complete region (e.g. an overseas
  // territory) must not make a country without its published summer break look free of holidays
  const knownYears = new Set(
    years.filter((year, i) => {
      if (regions.size === 0) return isCalendarYearComplete(periodsByYear[i], year);
      const complete = [...regions].filter((region) =>
        isCalendarYearComplete(
          periodsByYear[i].filter((p) => p.subdivisions.length === 0 || p.subdivisions.includes(region)),
          year
        )
      ).length;
      return complete >= regions.size / 2;
    })
  );
  const periods = periodsByYear.flat();
  // A country published only nationwide counts as one region
  const totalRegions = regions.size > 0 ? regions.size : periods.length > 0 ? 1 : 0;
  const holidays = publicHolidayNames(code, years, locale);

  const activeByDate = new Map<string, Set<string> | 'all'>();
  const days = eachDay(from, to).map((date) => {
    let regionsOnHoliday: number | null = null;
    if (totalRegions > 0 && knownYears.has(parseInt(date.slice(0, 4), 10))) {
      const active = new Set<string>();
      let nationwide = false;
      for (const p of periods) {
        if (date < p.startDate || date > p.endDate) continue;
        if (p.subdivisions.length === 0) nationwide = true;
        for (const s of p.subdivisions) active.add(s);
      }
      regionsOnHoliday = nationwide ? totalRegions : active.size;
      activeByDate.set(date, nationwide ? 'all' : active);
    }
    const publicHoliday = holidays.get(date);
    return { date, regionsOnHoliday, ...(publicHoliday ? { publicHoliday } : {}) };
  });
  return { country: code, totalRegions, days, regionCodes: [...regions], activeByDate };
}

export interface PersonalCalendarDay {
  date: string;
  /** School regions of the children on holiday that day */
  onHoliday: string[];
  /**
   * Other school regions of the home country on holiday that day (crowds and prices while the
   * family is free); null = unknown
   */
  otherRegionsOnHoliday: number | null;
  /** School regions without published holidays for that year */
  unknown: string[];
  publicHoliday?: string;
}

export interface PersonalCalendar {
  homeRegion: string;
  /** School regions of the school-age children; empty = no school children (not tied to holidays) */
  schoolRegions: string[];
  /** School regions without any school holiday data (country not covered) */
  regionsWithoutData: string[];
  /** Regions of the home country besides the family's own (the scale of otherRegionsOnHoliday) */
  otherRegionsTotal: number;
  days: PersonalCalendarDay[];
}

export async function getPersonalHolidayCalendar(
  homeRegion: string,
  schoolRegions: string[],
  from: string,
  to: string,
  locale: string
): Promise<PersonalCalendar> {
  const home = homeRegion.toUpperCase();
  // No fallback to the home region: a family without school children is free on every day
  const regions = [...new Set(schoolRegions.map((r) => r.toUpperCase()))];
  const years = yearsBetween(from, to);
  const byRegion = await Promise.all(
    regions.map(async (region) => {
      const perYear = await Promise.all(years.map((y) => getSchoolHolidays(region, y)));
      const known = new Set(
        years.filter((y, i) => isCalendarYearComplete(perYear[i].map((h) => ({ ...h, subdivisions: [] })), y))
      );
      return { region, known, holidays: perYear.flat() };
    })
  );
  const holidays = publicHolidayNames(home, years, locale);
  // The rest of the home country: how crowded the family's free days are
  const country = await buildCountryCalendar(home.split('-')[0], from, to, locale);
  const ownCodes = new Set(regions.map((r) => toOpenHolidaysSubdivision(r)).filter((r) => country.regionCodes.includes(r)));
  const otherRegionsTotal = Math.max(0, country.totalRegions - ownCodes.size);

  const days = eachDay(from, to).map((date) => {
    const year = parseInt(date.slice(0, 4), 10);
    const active = country.activeByDate.get(date);
    const otherRegionsOnHoliday =
      active === undefined ? null : active === 'all' ? otherRegionsTotal : [...active].filter((r) => !ownCodes.has(r)).length;
    const onHoliday: string[] = [];
    const unknown: string[] = [];
    for (const r of byRegion) {
      if (!r.known.has(year)) unknown.push(r.region);
      else if (r.holidays.some((h) => date >= h.startDate && date <= h.endDate)) onHoliday.push(r.region);
    }
    const publicHoliday = holidays.get(date);
    return { date, onHoliday, unknown, otherRegionsOnHoliday, ...(publicHoliday ? { publicHoliday } : {}) };
  });
  const regionsWithoutData = byRegion.filter((r) => r.holidays.length === 0).map((r) => r.region);
  return { homeRegion: home, schoolRegions: regions, regionsWithoutData, otherRegionsTotal, days };
}
