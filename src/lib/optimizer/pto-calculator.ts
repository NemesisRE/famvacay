import { parseISO, eachDayOfInterval, format, addDays } from 'date-fns';
import { PublicHoliday } from './types';

export interface PtoCalculationResult {
  totalWeekdays: number;
  publicHolidaysCount: number;
  ptoDaysConsumed: number;
  suggestedShifts?: AdjacentShiftSuggestion[];
}

export interface AdjacentShiftSuggestion {
  shiftDays: number; // e.g. -1, +1, -2, +2
  newStartDate: string;
  newEndDate: string;
  ptoSaved: number;
  newPtoDaysConsumed: number;
}

/**
 * Normalizes day-of-week check against user's configured workweek.
 * Supports both JS getDay() (0=Sunday, 1=Monday...6=Saturday)
 * and ISO weekdays (1=Monday...7=Sunday).
 */
export function isWorkday(date: Date, workweekDays: number[] = [1, 2, 3, 4, 5]): boolean {
  const jsDay = date.getDay(); // 0 is Sunday, 1 is Monday... 6 is Saturday
  const isoDay = jsDay === 0 ? 7 : jsDay;

  return workweekDays.includes(jsDay) || workweekDays.includes(isoDay);
}

/**
 * Calculates parental leave / PTO days consumed:
 * PTO_days_consumed = count(days in window that are workdays per the family's workweek)
 *                   - count(public holidays in the family's region that fall on such workdays)
 */
export function calculatePtoDaysConsumed(
  startDateStr: string,
  endDateStr: string,
  publicHolidays: PublicHoliday[] = [],
  workweekDays: number[] = [1, 2, 3, 4, 5]
): PtoCalculationResult {
  const start = parseISO(startDateStr);
  const end = parseISO(endDateStr);

  const holidayDateSet = new Set(publicHolidays.map((h) => h.date));
  const allDays = eachDayOfInterval({ start, end });

  let totalWeekdays = 0;
  let publicHolidaysCount = 0;

  for (const day of allDays) {
    const isWk = isWorkday(day, workweekDays);
    const dayStr = format(day, 'yyyy-MM-dd');
    const isHoliday = holidayDateSet.has(dayStr);

    if (isWk) {
      totalWeekdays++;
      if (isHoliday) {
        publicHolidaysCount++;
      }
    }
  }

  const ptoDaysConsumed = Math.max(0, totalWeekdays - publicHolidaysCount);

  // Suggest adjacent shifts (±1–3 days) that reduce PTO via weekends and public holidays
  const suggestedShifts = suggestAdjacentPtoShifts(
    startDateStr,
    endDateStr,
    publicHolidays,
    workweekDays,
    ptoDaysConsumed
  );

  return {
    totalWeekdays,
    publicHolidaysCount,
    ptoDaysConsumed,
    suggestedShifts: suggestedShifts.length > 0 ? suggestedShifts : undefined,
  };
}

/**
 * Evaluates candidate shifts of ±1, ±2, and ±3 days to find shifts of the SAME duration
 * that consume fewer PTO days.
 */
export function suggestAdjacentPtoShifts(
  startDateStr: string,
  endDateStr: string,
  publicHolidays: PublicHoliday[],
  workweekDays: number[] = [1, 2, 3, 4, 5],
  currentPto?: number
): AdjacentShiftSuggestion[] {
  const start = parseISO(startDateStr);
  const end = parseISO(endDateStr);

  const baselinePto = currentPto !== undefined
    ? currentPto
    : calculatePtoDaysConsumed(startDateStr, endDateStr, publicHolidays, workweekDays).ptoDaysConsumed;

  const suggestions: AdjacentShiftSuggestion[] = [];
  const holidayDateSet = new Set(publicHolidays.map((h) => h.date));

  const shifts = [-3, -2, -1, 1, 2, 3];

  for (const shift of shifts) {
    const shiftedStart = addDays(start, shift);
    const shiftedEnd = addDays(end, shift);

    const days = eachDayOfInterval({ start: shiftedStart, end: shiftedEnd });
    let shiftPto = 0;

    for (const d of days) {
      if (isWorkday(d, workweekDays)) {
        const dStr = format(d, 'yyyy-MM-dd');
        if (!holidayDateSet.has(dStr)) {
          shiftPto++;
        }
      }
    }

    if (shiftPto < baselinePto) {
      suggestions.push({
        shiftDays: shift,
        newStartDate: format(shiftedStart, 'yyyy-MM-dd'),
        newEndDate: format(shiftedEnd, 'yyyy-MM-dd'),
        ptoSaved: baselinePto - shiftPto,
        newPtoDaysConsumed: shiftPto,
      });
    }
  }

  // Sort suggestions by most PTO saved descending
  return suggestions.sort((a, b) => b.ptoSaved - a.ptoSaved);
}
