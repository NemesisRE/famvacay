import { parseISO, eachDayOfInterval, format, addDays } from 'date-fns';
import { PublicHoliday } from './types';

export interface PtoCalculationResult {
  totalWeekdays: number;
  publicHolidaysCount: number;
  ptoDaysConsumed: number;
  suggestedShifts?: AdjacentShiftSuggestion[];
}

export interface ChildcareClosurePeriod {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  coverageFactor: number; // 1.0 = parents cover 100% of closure days with own PTO, 0.5 = grandparents cover half
}

export interface EffectivePtoCalculationResult extends PtoCalculationResult {
  effectivePtoDaysConsumed: number;
  overlappingClosureWeekdays: number;
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
 * Calculates effective marginal PTO consumption when one or more CHILDCARE_CLOSURE
 * periods (e.g. a 2-3 week Kita/daycare closure) overlap the candidate window.
 *
 * EffectivePTO = TotalWeekdays - PublicHolidays - (OverlappingClosureWeekdays x coverageFactor)
 *
 * Rationale: parents must take time off work during a mandatory daycare closure regardless
 * of whether they travel, so weekdays inside the closure consume 0 *marginal* PTO (scaled by
 * coverageFactor when grandparents/other care partially covers the closure).
 */
export function calculateEffectivePtoDaysConsumed(
  startDateStr: string,
  endDateStr: string,
  publicHolidays: PublicHoliday[] = [],
  workweekDays: number[] = [1, 2, 3, 4, 5],
  childcareClosures: ChildcareClosurePeriod[] = []
): EffectivePtoCalculationResult {
  const base = calculatePtoDaysConsumed(startDateStr, endDateStr, publicHolidays, workweekDays);

  if (childcareClosures.length === 0) {
    return {
      ...base,
      effectivePtoDaysConsumed: base.ptoDaysConsumed,
      overlappingClosureWeekdays: 0,
    };
  }

  const start = parseISO(startDateStr);
  const end = parseISO(endDateStr);
  const holidayDateSet = new Set(publicHolidays.map((h) => h.date));
  const allDays = eachDayOfInterval({ start, end });

  let closureWeightedDays = 0;
  let overlappingClosureWeekdays = 0;

  for (const day of allDays) {
    if (!isWorkday(day, workweekDays)) continue;
    const dayStr = format(day, 'yyyy-MM-dd');
    if (holidayDateSet.has(dayStr)) continue; // already excluded from the PTO base

    let dayCoverage = 0;
    for (const closure of childcareClosures) {
      if (dayStr >= closure.startDate && dayStr <= closure.endDate) {
        dayCoverage = Math.max(dayCoverage, closure.coverageFactor);
      }
    }

    if (dayCoverage > 0) {
      overlappingClosureWeekdays++;
      closureWeightedDays += dayCoverage;
    }
  }

  const effectivePtoDaysConsumed = Math.max(
    0,
    Math.round((base.ptoDaysConsumed - closureWeightedDays) * 100) / 100
  );

  return {
    ...base,
    effectivePtoDaysConsumed,
    overlappingClosureWeekdays,
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
