import { getCountrySchoolHolidays } from '../integrations/open-holidays';
import {
  SOURCE_MARKETS,
  buildMarketCalendar,
  getTypicalSchoolHolidays,
  isCalendarYearComplete,
  type MarketHolidayCalendar,
} from './source-markets';

/**
 * Loads the school-holiday calendars of all source markets for the given years: official
 * per-region calendars from OpenHolidays where available, typical national patterns otherwise
 * (GB, IT, ES are not covered by OpenHolidays; FR/PL data can be incomplete), decided per year.
 */
export async function loadSourceMarketCalendars(years: number[]): Promise<MarketHolidayCalendar[]> {
  return Promise.all(
    SOURCE_MARKETS.map(async (market) => {
      const perYear = await Promise.all(
        years.map(async (year) => {
          const official = await getCountrySchoolHolidays(market.country, year);
          // Keep only periods touching this year (OpenHolidays includes the Christmas break that
          // started the year before), so per-year fallbacks do not overlap
          const inYear = official.filter((p) => p.endDate >= `${year}-01-01` && p.startDate <= `${year}-12-31`);
          if (isCalendarYearComplete(inYear, year)) return { periods: inYear, official: true };
          const typical = getTypicalSchoolHolidays(market.country, year);
          return typical.length > 0 ? { periods: typical, official: false } : { periods: inYear, official: true };
        })
      );
      const source = perYear.every((y) => y.official) ? 'school-calendar' : 'typical';
      return buildMarketCalendar(market, perYear.flatMap((y) => y.periods), source);
    })
  );
}
