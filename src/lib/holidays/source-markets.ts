import { addDays, format, parseISO } from 'date-fns';
import { getEasterDate } from '../optimizer/weather';
import type { CountrySchoolHolidayPeriod } from '../integrations/open-holidays';

/**
 * Source-market demand model: how many of Europe's big holiday markets are on school holidays
 * during a trip window. Prices and crowding at holiday destinations are driven by *all* major
 * markets travelling at once (Dutch, Belgian, French, British... holidays), not only by the
 * family's own region.
 */

export interface SourceMarket {
  country: string; // ISO 3166-1 alpha-2
  /** Approximate share of European outbound leisure travel demand */
  weight: number;
}

/** Big European source markets, weighted roughly by outbound family/leisure travel volume. */
export const SOURCE_MARKETS: SourceMarket[] = [
  { country: 'DE', weight: 0.25 },
  { country: 'GB', weight: 0.17 },
  { country: 'FR', weight: 0.14 },
  { country: 'IT', weight: 0.1 },
  { country: 'ES', weight: 0.08 },
  { country: 'NL', weight: 0.07 },
  { country: 'PL', weight: 0.06 },
  { country: 'BE', weight: 0.04 },
  { country: 'CH', weight: 0.03 },
  { country: 'AT', weight: 0.03 },
  { country: 'CZ', weight: 0.03 },
];

/** Domestic holidays dominate local demand (French coast in July, Italian beaches in August). */
const DOMESTIC_WEIGHT_FACTOR = 3;
/** Long-haul destinations are far less exposed to European school-holiday peaks. */
const LONG_HAUL_EXPOSURE = 0.6;

export interface MarketHolidayCalendar {
  country: string;
  weight: number;
  /** 'school-calendar' = official per-region data, 'typical' = usual national pattern */
  source: 'school-calendar' | 'typical';
  periods: CountrySchoolHolidayPeriod[];
  /** Number of distinct subdivisions in the data (share denominator); 0 = national periods only */
  subdivisionCount: number;
}

export function buildMarketCalendar(market: SourceMarket, periods: CountrySchoolHolidayPeriod[], source: MarketHolidayCalendar['source']): MarketHolidayCalendar {
  const subdivisions = new Set<string>();
  for (const p of periods) for (const s of p.subdivisions) subdivisions.add(s);
  return { country: market.country, weight: market.weight, source, periods, subdivisionCount: subdivisions.size };
}

const iso = (d: Date) => format(d, 'yyyy-MM-dd');
const easter = (year: number) => {
  const e = getEasterDate(year);
  return new Date(year, e.month, e.day);
};
const nationwide = (start: Date, end: Date): CountrySchoolHolidayPeriod => ({ startDate: iso(start), endDate: iso(end), subdivisions: [] });

/**
 * Typical national school-holiday pattern for markets OpenHolidays does not cover. Coarse by
 * design (single national calendar, usual dates) - good enough to model demand peaks.
 */
export function getTypicalSchoolHolidays(country: string, year: number): CountrySchoolHolidayPeriod[] {
  const e = easter(year);
  switch (country) {
    case 'GB': {
      // England: Christmas, Feb / May / Oct half-terms, two weeks around Easter, summer
      const thirdMondayFeb = (() => {
        const d = new Date(year, 1, 1);
        const firstMonday = addDays(d, (8 - d.getDay()) % 7);
        return addDays(firstMonday, 14);
      })();
      const lastMondayMay = (() => {
        const d = new Date(year, 4, 31);
        return addDays(d, -((d.getDay() + 6) % 7));
      })();
      const lastMondayOct = (() => {
        const d = new Date(year, 9, 31);
        return addDays(d, -((d.getDay() + 6) % 7));
      })();
      return [
        nationwide(new Date(year, 0, 1), new Date(year, 0, 3)),
        nationwide(addDays(thirdMondayFeb, -2), addDays(thirdMondayFeb, 6)),
        nationwide(addDays(e, -9), addDays(e, 8)),
        nationwide(addDays(lastMondayMay, -2), addDays(lastMondayMay, 6)),
        nationwide(new Date(year, 6, 22), new Date(year, 8, 2)),
        nationwide(addDays(lastMondayOct, -2), addDays(lastMondayOct, 6)),
        nationwide(new Date(year, 11, 20), new Date(year, 11, 31)),
      ];
    }
    case 'IT':
      return [
        nationwide(new Date(year, 0, 1), new Date(year, 0, 6)),
        nationwide(addDays(e, -3), addDays(e, 2)),
        nationwide(new Date(year, 5, 10), new Date(year, 8, 13)),
        nationwide(new Date(year, 11, 23), new Date(year, 11, 31)),
      ];
    case 'FR':
      // Metropolitan France: Toussaint, Christmas, winter and spring breaks (core of the three
      // staggered zones), summer
      return [
        nationwide(new Date(year, 0, 1), new Date(year, 0, 3)),
        nationwide(new Date(year, 1, 13), new Date(year, 2, 1)),
        nationwide(new Date(year, 3, 17), new Date(year, 4, 2)),
        nationwide(new Date(year, 6, 4), new Date(year, 7, 31)),
        nationwide(new Date(year, 9, 17), new Date(year, 10, 1)),
        nationwide(new Date(year, 11, 19), new Date(year, 11, 31)),
      ];
    case 'PL':
      return [
        nationwide(new Date(year, 0, 1), new Date(year, 0, 1)),
        nationwide(addDays(e, -3), addDays(e, 2)),
        nationwide(new Date(year, 5, 26), new Date(year, 7, 31)),
        nationwide(new Date(year, 11, 23), new Date(year, 11, 31)),
      ];
    case 'ES':
      return [
        nationwide(new Date(year, 0, 1), new Date(year, 0, 7)),
        nationwide(addDays(e, -7), addDays(e, 1)),
        nationwide(new Date(year, 5, 21), new Date(year, 8, 8)),
        nationwide(new Date(year, 11, 22), new Date(year, 11, 31)),
      ];
    default:
      return [];
  }
}

/**
 * OpenHolidays data can be incomplete for a year (e.g. only overseas territories, or a one-day stub
 * for a summer break not yet published). Every European school region has a summer break of at
 * least three weeks in July/August, so data without one is not trusted for that year.
 */
export function isCalendarYearComplete(periods: CountrySchoolHolidayPeriod[], year: number): boolean {
  const summerStart = parseISO(`${year}-07-01`);
  const summerEnd = parseISO(`${year}-08-31`);
  return periods.some((p) => {
    const start = parseISO(p.startDate) > summerStart ? parseISO(p.startDate) : summerStart;
    const end = parseISO(p.endDate) < summerEnd ? parseISO(p.endDate) : summerEnd;
    return (end.getTime() - start.getTime()) / 86400000 + 1 >= 21;
  });
}

/**
 * Share (0-1) of a market's school children on holiday on a given day: the fraction of its
 * subdivisions with an active period (nationwide periods count as everyone).
 */
export function getMarketHolidayShare(calendar: MarketHolidayCalendar, date: string): number {
  const active = new Set<string>();
  for (const p of calendar.periods) {
    if (date < p.startDate || date > p.endDate) continue;
    if (p.subdivisions.length === 0 || calendar.subdivisionCount === 0) return 1;
    for (const s of p.subdivisions) active.add(s);
  }
  return calendar.subdivisionCount > 0 ? active.size / calendar.subdivisionCount : 0;
}

export interface SourceMarketDemand {
  /** 0 = no big market on holiday, 1 = all of them */
  index: number;
  /** Markets with at least half of their children on holiday during the window */
  marketsOnHoliday: string[];
}

export interface SourceMarketDemandTimeline {
  /** Demand during [startDate, endDate] (inclusive) at a destination in `destinationCountry` */
  demandFor(startDate: string, endDate: string, destinationCountry?: string, isLongHaul?: boolean): SourceMarketDemand;
}

/**
 * Precomputes each market's daily holiday share over [rangeStart, rangeEnd] as prefix sums, so the
 * optimizer can query thousands of windows in O(markets) each.
 */
export function buildSourceMarketDemandTimeline(
  calendars: MarketHolidayCalendar[],
  rangeStart: string,
  rangeEnd: string
): SourceMarketDemandTimeline {
  const start = parseISO(rangeStart);
  const days: string[] = [];
  for (let d = start; iso(d) <= rangeEnd; d = addDays(d, 1)) days.push(iso(d));
  const dayIndex = new Map(days.map((d, i) => [d, i]));
  const prefix = calendars.map((cal) => {
    const sums = new Float64Array(days.length + 1);
    days.forEach((day, i) => {
      sums[i + 1] = sums[i] + getMarketHolidayShare(cal, day);
    });
    return sums;
  });

  const avgShare = (calIdx: number, startDate: string, endDate: string): number => {
    const from = dayIndex.get(startDate);
    const to = dayIndex.get(endDate);
    if (from !== undefined && to !== undefined && to >= from) {
      return (prefix[calIdx][to + 1] - prefix[calIdx][from]) / (to - from + 1);
    }
    // Outside the precomputed range: evaluate directly
    let sum = 0;
    let n = 0;
    for (let d = parseISO(startDate); iso(d) <= endDate; d = addDays(d, 1), n++) sum += getMarketHolidayShare(calendars[calIdx], iso(d));
    return n > 0 ? sum / n : 0;
  };

  return {
    demandFor(startDate, endDate, destinationCountry, isLongHaul = false) {
      if (calendars.length === 0) return { index: 0, marketsOnHoliday: [] };
      let weightedShare = 0;
      let totalWeight = 0;
      const onHoliday: { country: string; weight: number }[] = [];
      calendars.forEach((cal, i) => {
        const weight = cal.country === destinationCountry ? cal.weight * DOMESTIC_WEIGHT_FACTOR : cal.weight;
        const share = avgShare(i, startDate, endDate);
        weightedShare += weight * share;
        totalWeight += weight;
        if (share >= 0.5) onHoliday.push({ country: cal.country, weight: cal.weight });
      });
      const index = (totalWeight > 0 ? weightedShare / totalWeight : 0) * (isLongHaul ? LONG_HAUL_EXPOSURE : 1);
      return {
        index: Math.round(index * 100) / 100,
        marketsOnHoliday: onHoliday.sort((a, b) => b.weight - a.weight).map((m) => m.country),
      };
    },
  };
}

/**
 * Demand from foreign and domestic source markets during [startDate, endDate] at a destination
 * in `destinationCountry`. `isLongHaul` dampens the effect for destinations outside Europe.
 */
export function computeSourceMarketDemand(
  calendars: MarketHolidayCalendar[],
  startDate: string,
  endDate: string,
  destinationCountry?: string,
  isLongHaul = false
): SourceMarketDemand {
  return buildSourceMarketDemandTimeline(calendars, startDate, endDate).demandFor(startDate, endDate, destinationCountry, isLongHaul);
}

/** Price surcharge factor on flights and lodging at full demand (all big markets on holiday). */
export const MAX_DEMAND_SURCHARGE = 0.18;
/** Demand index from which a window counts as European high season. */
export const HIGH_DEMAND_THRESHOLD = 0.45;
/** Demand index up to which a window counts as a quiet travel period. */
export const LOW_DEMAND_THRESHOLD = 0.1;
