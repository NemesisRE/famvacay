import { describe, it, expect } from 'vitest';
import {
  calculatePtoDaysConsumed,
  calculateEffectivePtoDaysConsumed,
  suggestAdjacentPtoShifts,
  FIVE_DAY_WORKWEEK,
  SIX_DAY_WORKWEEK,
} from '../pto-calculator';
import type { PublicHoliday } from '../types';

const holiday = (date: string, name = 'Holiday'): PublicHoliday => ({ date, name });

// 2027-05-01 (Labour Day) and 2027-12-25 (Christmas) fall on a Saturday, 2027-12-26 on a
// Sunday, 2026-05-01 on a Friday.
describe('PTO days in a five-day vs. a six-day workweek', () => {
  it('counts Saturdays as workdays only in the six-day week', () => {
    // Monday 2027-04-19 to Sunday 2027-04-25, no public holiday
    const five = calculatePtoDaysConsumed('2027-04-19', '2027-04-25', [], FIVE_DAY_WORKWEEK);
    const six = calculatePtoDaysConsumed('2027-04-19', '2027-04-25', [], SIX_DAY_WORKWEEK);
    expect(five).toMatchObject({ totalWeekdays: 5, publicHolidaysCount: 0, ptoDaysConsumed: 5 });
    expect(six).toMatchObject({ totalWeekdays: 6, publicHolidaysCount: 0, ptoDaysConsumed: 6 });
  });

  it('a public holiday on a Saturday saves a PTO day in the six-day week only', () => {
    const holidays = [holiday('2027-05-01', 'Labour Day')];
    // Monday 2027-04-26 to Sunday 2027-05-02
    const five = calculatePtoDaysConsumed('2027-04-26', '2027-05-02', holidays, FIVE_DAY_WORKWEEK);
    const six = calculatePtoDaysConsumed('2027-04-26', '2027-05-02', holidays, SIX_DAY_WORKWEEK);
    expect(five).toMatchObject({ totalWeekdays: 5, publicHolidaysCount: 0, ptoDaysConsumed: 5 });
    expect(six).toMatchObject({ totalWeekdays: 6, publicHolidaysCount: 1, ptoDaysConsumed: 5 });
  });

  it('a public holiday on a weekday saves a PTO day in both weeks', () => {
    const holidays = [holiday('2026-05-01', 'Labour Day')];
    // Monday 2026-04-27 to Sunday 2026-05-03, the holiday is the Friday
    const five = calculatePtoDaysConsumed('2026-04-27', '2026-05-03', holidays, FIVE_DAY_WORKWEEK);
    const six = calculatePtoDaysConsumed('2026-04-27', '2026-05-03', holidays, SIX_DAY_WORKWEEK);
    expect(five).toMatchObject({ publicHolidaysCount: 1, ptoDaysConsumed: 4 });
    expect(six).toMatchObject({ publicHolidaysCount: 1, ptoDaysConsumed: 5 });
  });

  it('a public holiday on a Sunday saves no PTO day in either week', () => {
    const holidays = [holiday('2027-12-26', 'Boxing Day')];
    // Monday 2027-12-20 to Sunday 2027-12-26
    const five = calculatePtoDaysConsumed('2027-12-20', '2027-12-26', holidays, FIVE_DAY_WORKWEEK);
    const six = calculatePtoDaysConsumed('2027-12-20', '2027-12-26', holidays, SIX_DAY_WORKWEEK);
    expect(five).toMatchObject({ publicHolidaysCount: 0, ptoDaysConsumed: 5 });
    expect(six).toMatchObject({ publicHolidaysCount: 0, ptoDaysConsumed: 6 });
  });

  it('Christmas on Saturday and Boxing Day on Sunday: only the Saturday counts, only Mon-Sat', () => {
    const holidays = [holiday('2027-12-25', 'Christmas'), holiday('2027-12-26', 'Boxing Day')];
    const five = calculatePtoDaysConsumed('2027-12-20', '2027-12-26', holidays, FIVE_DAY_WORKWEEK);
    const six = calculatePtoDaysConsumed('2027-12-20', '2027-12-26', holidays, SIX_DAY_WORKWEEK);
    expect(five.ptoDaysConsumed).toBe(5);
    expect(six).toMatchObject({ totalWeekdays: 6, publicHolidaysCount: 1, ptoDaysConsumed: 5 });
  });

  it('childcare closure coverage also applies to Saturdays in the six-day week', () => {
    // Closure fully covered by the parents' own leave anyway, Saturday 2027-04-24 included
    const closures = [{ startDate: '2027-04-23', endDate: '2027-04-24', coverageFactor: 1 }];
    const five = calculateEffectivePtoDaysConsumed('2027-04-19', '2027-04-25', [], FIVE_DAY_WORKWEEK, closures);
    const six = calculateEffectivePtoDaysConsumed('2027-04-19', '2027-04-25', [], SIX_DAY_WORKWEEK, closures);
    expect(five).toMatchObject({ ptoDaysConsumed: 5, effectivePtoDaysConsumed: 4, overlappingClosureWeekdays: 1 });
    expect(six).toMatchObject({ ptoDaysConsumed: 6, effectivePtoDaysConsumed: 4, overlappingClosureWeekdays: 2 });
  });
});

describe('bridge-day shifts in the six-day week', () => {
  it('moving the trip onto a Saturday holiday saves a PTO day only for a six-day week', () => {
    const holidays = [holiday('2027-05-01', 'Labour Day')];
    // Sunday 2027-05-02 to Saturday 2027-05-08; one day earlier starts on the Saturday holiday
    const sixShifts = suggestAdjacentPtoShifts('2027-05-02', '2027-05-08', holidays, SIX_DAY_WORKWEEK);
    expect(sixShifts).toContainEqual(
      expect.objectContaining({ shiftDays: -1, newStartDate: '2027-05-01', ptoSaved: 1, newPtoDaysConsumed: 5 })
    );
    const fiveShifts = suggestAdjacentPtoShifts('2027-05-02', '2027-05-08', holidays, FIVE_DAY_WORKWEEK);
    expect(fiveShifts.find((s) => s.shiftDays === -1)).toBeUndefined();
  });

  it('skips the shift suggestions on request', () => {
    const result = calculatePtoDaysConsumed('2027-05-02', '2027-05-08', [holiday('2027-05-01')], SIX_DAY_WORKWEEK, {
      suggestShifts: false,
    });
    expect(result.suggestedShifts).toBeUndefined();
    expect(result.ptoDaysConsumed).toBe(6);
  });
});
