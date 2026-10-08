import { parseISO, isWeekend, eachDayOfInterval, format } from 'date-fns';
import { PublicHoliday } from './types';

/**
 * Calculates parental leave days consumed:
 * PTO_days_consumed = total_weekdays_in_window - public_holidays_in_window
 */
export function calculatePtoDaysConsumed(
  startDateStr: string,
  endDateStr: string,
  publicHolidays: PublicHoliday[]
): { totalWeekdays: number; publicHolidaysCount: number; ptoDaysConsumed: number } {
  const start = parseISO(startDateStr);
  const end = parseISO(endDateStr);

  const holidayDateSet = new Set(publicHolidays.map((h) => h.date));
  const allDays = eachDayOfInterval({ start, end });

  let totalWeekdays = 0;
  let publicHolidaysCount = 0;

  for (const day of allDays) {
    const isWknd = isWeekend(day);
    const dayStr = format(day, 'yyyy-MM-dd');
    const isHoliday = holidayDateSet.has(dayStr);

    if (!isWknd) {
      totalWeekdays++;
      if (isHoliday) {
        publicHolidaysCount++;
      }
    }
  }

  const ptoDaysConsumed = Math.max(0, totalWeekdays - publicHolidaysCount);

  return {
    totalWeekdays,
    publicHolidaysCount,
    ptoDaysConsumed,
  };
}

