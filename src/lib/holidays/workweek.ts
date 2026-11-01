/**
 * Workweeks and weekends worldwide, as ISO weekdays (1 = Monday ... 7 = Sunday).
 *
 * The weekend of a country comes from the Unicode CLDR week data built into every JavaScript
 * engine (Intl.Locale week info): Saturday/Sunday in most countries, Friday/Saturday in Saudi
 * Arabia, Israel, Egypt or the Gulf states, Friday only in Iran, Thursday/Friday in Afghanistan.
 * The usual week of the home country is a best guess - travellers in one party may work different
 * weeks - so the PTO popover shows a five-day and a six-day week next to each other.
 */

export const ALL_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];
const FALLBACK_WEEKEND = [6, 7];
const FALLBACK_FIRST_DAY = 1;

interface WeekInfo {
  firstDay: number;
  weekend: number[];
}

const weekInfoCache = new Map<string, WeekInfo>();

/** CLDR week data of a country (ISO 3166 alpha-2); Saturday/Sunday when unknown. */
export function countryWeekInfo(countryCode: string | undefined): WeekInfo {
  const code = (countryCode || '').toUpperCase();
  const cached = weekInfoCache.get(code);
  if (cached) return cached;
  let info: WeekInfo = { firstDay: FALLBACK_FIRST_DAY, weekend: FALLBACK_WEEKEND };
  if (/^[A-Z]{2}$/.test(code)) {
    try {
      const locale = new Intl.Locale(`und-${code}`) as Intl.Locale & {
        getWeekInfo?: () => Partial<WeekInfo>;
        weekInfo?: Partial<WeekInfo>;
      };
      const data = locale.getWeekInfo?.() ?? locale.weekInfo;
      if (data?.weekend?.length) {
        info = { firstDay: data.firstDay ?? FALLBACK_FIRST_DAY, weekend: [...data.weekend].sort((a, b) => a - b) };
      }
    } catch {
      // Engines without week data keep the fallback
    }
  }
  weekInfoCache.set(code, info);
  return info;
}

export function countryWeekend(countryCode: string | undefined): number[] {
  return countryWeekInfo(countryCode).weekend;
}

/** The usual workweek of a country: every day outside its weekend. */
export function defaultWorkweek(countryCode: string | undefined): number[] {
  const weekend = countryWeekend(countryCode);
  return ALL_WEEKDAYS.filter((d) => !weekend.includes(d));
}

/** Saved workdays (ISO, JS Sunday = 0 accepted) as a sorted ISO list, or null when unusable/empty. */
export function normalizeWorkweek(days: unknown): number[] | null {
  if (!Array.isArray(days)) return null;
  const valid = days
    .map((d) => (d === 0 ? 7 : d))
    .filter((d): d is number => Number.isInteger(d) && d >= 1 && d <= 7);
  const unique = [...new Set(valid)].sort((a, b) => a - b);
  return unique.length > 0 ? unique : null;
}

/** The workdays in effect: the user's own, else their home country's usual week. */
export function resolveWorkweek(days: unknown, countryCode: string | undefined): number[] {
  return normalizeWorkweek(days) ?? defaultWorkweek(countryCode);
}

export function isoWeekday(date: Date): number {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

/**
 * The weeks shown next to the usual one, so there is always a five-day and a six-day week:
 * - usual five-day week: the six-day weeks - the five workdays plus one of the two days off. Where
 *   Sunday is one of them it stays free (Monday-Saturday). Otherwise which day is the rest day
 *   differs between countries sharing the same weekend (Israel works Sunday-Friday, the Gulf
 *   states Saturday-Thursday), so both are offered.
 * - usual six-day week (a single weekend day, e.g. Friday in Iran): the five-day week that also
 *   frees the day before the weekend (Saturday-Wednesday in Iran, Monday-Friday in India).
 */
export function comparisonWorkweeks(workweek: number[]): number[][] {
  const daysOff = ALL_WEEKDAYS.filter((d) => !workweek.includes(d));
  if (workweek.length === 5) {
    const candidates = daysOff.includes(7) ? daysOff.filter((d) => d !== 7) : daysOff;
    return candidates.map((d) => [...workweek, d].sort((x, y) => x - y));
  }
  if (workweek.length === 6) {
    const dayBefore = daysOff[0] === 1 ? 7 : daysOff[0] - 1;
    return [workweek.filter((d) => d !== dayBefore)];
  }
  return [];
}

/** The days in their order within the week, starting after the days off (Sunday-Thursday, not 1-4 + 7). */
export function orderedWeekdays(days: number[]): number[] {
  if (days.length === 0 || days.length === 7) return [...days].sort((a, b) => a - b);
  const set = new Set(days);
  // Start at the first day whose previous day is not part of the set
  const start = ALL_WEEKDAYS.find((d) => set.has(d) && !set.has(d === 1 ? 7 : d - 1)) ?? days[0];
  const ordered: number[] = [];
  for (let i = 0; i < 7; i++) {
    const d = ((start - 1 + i) % 7) + 1;
    if (set.has(d)) ordered.push(d);
  }
  return ordered;
}

/** Short weekday name in a language, without abbreviation dots ("Mo", "Mon", "lun"). */
export function weekdayName(isoDay: number, locale: string, style: 'short' | 'long' = 'short'): string {
  // 2024-01-01 was a Monday
  const date = new Date(Date.UTC(2024, 0, isoDay));
  const name = new Intl.DateTimeFormat(locale, { weekday: style, timeZone: 'UTC' }).format(date);
  return style === 'short' ? name.replace(/\.$/, '') : name;
}

/**
 * Readable label of a set of workdays: a range when the days follow each other ("Mo–Fr",
 * "So–Do", "Sa–Do"), otherwise the single days.
 */
export function workweekLabel(days: number[], locale: string): string {
  const ordered = orderedWeekdays(days);
  if (ordered.length === 0) return '';
  const contiguous = ordered.every((d, i) => i === 0 || d === (ordered[i - 1] % 7) + 1);
  if (ordered.length >= 3 && contiguous) {
    return `${weekdayName(ordered[0], locale)}–${weekdayName(ordered[ordered.length - 1], locale)}`;
  }
  return ordered.map((d) => weekdayName(d, locale)).join(', ');
}
