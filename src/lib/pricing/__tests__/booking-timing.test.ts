import { describe, expect, it } from 'vitest';
import {
  bookingTimingParamsForCandidate,
  calendarDaysBetween,
  evaluateBookingTiming,
  evaluateBookingTimingForCandidate,
  type BookingTimingParams,
} from '../booking-timing';
import type { CandidateWindow } from '../../optimizer/types';

const REFERENCE = new Date(2026, 9, 25); // 25 Oct 2026

function daysOut(days: number): Date {
  return new Date(REFERENCE.getFullYear(), REFERENCE.getMonth(), REFERENCE.getDate() + days);
}

function advise(overrides: Partial<BookingTimingParams> & { days: number }) {
  const { days, ...rest } = overrides;
  return evaluateBookingTiming({
    startDate: daysOut(days),
    referenceDate: REFERENCE,
    isSchoolHolidayPeak: false,
    distanceKm: 1800,
    travelMode: 'FLIGHT',
    requiresFamilyRoomTopology: false,
    ...rest,
  });
}

describe('evaluateBookingTiming: acceptance cases', () => {
  it('peak school-holiday summer trip 220 days out is in the early-bird sweet spot', () => {
    const advice = advise({ days: 220, isSchoolHolidayPeak: true });
    expect(advice.status).toBe('EARLY_BIRD_SWEET_SPOT');
    expect(advice.tone).toBe('positive');
    expect(advice.transportAction).toBe('BOOK_NOW');
    expect(advice.accommodationAction).toBe('BOOK_NOW_FLEXIBLE');
    expect(advice.reasons).toContain('EARLY_BIRD_DISCOUNTS');
  });

  it('off-peak short-haul trip 220 days out should wait for the price drop', () => {
    const advice = advise({ days: 220 });
    expect(advice.status).toBe('WAIT_FOR_PRICE_DROP');
    expect(advice.transportAction).toBe('WAIT');
    expect(advice.transportWindow).toEqual({ fromDaysBefore: 140, toDaysBefore: 45 });
    // Accommodation with free cancellation can still be secured now
    expect(advice.accommodationAction).toBe('RESERVE_REFUNDABLE');
  });

  it('off-peak short-haul trip 75 days out is in the optimal window', () => {
    const advice = advise({ days: 75 });
    expect(advice.status).toBe('OPTIMAL_BOOKING_WINDOW');
    expect(advice.reasons).toEqual(['YIELD_DIP']);
  });

  it('trip 400 days out is too early: schedules are not published yet', () => {
    const advice = advise({ days: 400 });
    expect(advice.status).toBe('TOO_EARLY_SCHEDULE_LOCKED');
    expect(advice.transportAction).toBe('NOT_YET_BOOKABLE');
    expect(advice.reasons).toContain('SCHEDULE_NOT_RELEASED');
  });

  it('school-holiday trip 20 days out is urgent', () => {
    const advice = advise({ days: 20, isSchoolHolidayPeak: true });
    expect(advice.status).toBe('HIGH_URGENCY_SCARCITY');
    expect(advice.tone).toBe('urgent');
    expect(advice.reasons).toEqual(['PEAK_SCARCITY', 'LATE_FARE_SPIKE']);
  });
});

describe('evaluateBookingTiming: lead-time buckets and precedence', () => {
  it('uses an 11-month horizon for flights but a year for overland trips', () => {
    expect(advise({ days: 340 }).status).toBe('TOO_EARLY_SCHEDULE_LOCKED');
    expect(advise({ days: 340, travelMode: 'TRAIN' }).status).not.toBe('TOO_EARLY_SCHEDULE_LOCKED');
    expect(advise({ days: 370, travelMode: 'TRAIN' }).reasons).toContain('RAIL_TIMETABLE_NOT_OPEN');
    expect(advise({ days: 370, travelMode: 'CAR' }).reasons).toContain('ACCOMMODATION_NOT_OPEN');
  });

  it('school holidays 14-44 days out are urgent, also for car trips', () => {
    expect(advise({ days: 40, isSchoolHolidayPeak: true }).status).toBe('HIGH_URGENCY_SCARCITY');
    expect(advise({ days: 30, isSchoolHolidayPeak: true, travelMode: 'CAR' }).status).toBe('HIGH_URGENCY_SCARCITY');
  });

  it('off-peak flights under two weeks point to package deals instead of flight-only fares', () => {
    const advice = advise({ days: 10 });
    expect(advice.status).toBe('LAST_MINUTE_GAMBLE');
    expect(advice.transportAction).toBe('CHECK_PACKAGES');
    expect(advice.accommodationAction).toBe('COMPARE_PACKAGES');
  });

  it('any flight or rail fare inside three weeks is urgent', () => {
    expect(advise({ days: 18 }).status).toBe('HIGH_URGENCY_SCARCITY');
    expect(advise({ days: 10, travelMode: 'TRAIN' }).status).toBe('HIGH_URGENCY_SCARCITY');
    expect(advise({ days: 18 }).reasons).toEqual(['LATE_FARE_SPIKE']);
  });

  it('off-peak flights past the lowest-price window are already getting more expensive', () => {
    const advice = advise({ days: 30 });
    expect(advice.status).toBe('HIGH_URGENCY_SCARCITY');
    expect(advice.reasons).toEqual(['FARES_RISING']);
  });

  it('long-haul: early bird 150-300 days out, optimal from 90 days, rising below', () => {
    expect(advise({ days: 250, distanceKm: 9000 }).status).toBe('EARLY_BIRD_SWEET_SPOT');
    expect(advise({ days: 250, distanceKm: 9000 }).reasons).toContain('LONG_HAUL_FARES');
    expect(advise({ days: 120, distanceKm: 9000 }).status).toBe('OPTIMAL_BOOKING_WINDOW');
    expect(advise({ days: 120, distanceKm: 9000 }).transportWindow).toEqual({ fromDaysBefore: 210, toDaysBefore: 90 });
    expect(advise({ days: 60, distanceKm: 9000 }).status).toBe('HIGH_URGENCY_SCARCITY');
  });

  it('families needing a family room book accommodation early even off-peak, but wait with short-haul flights', () => {
    const advice = advise({ days: 220, requiresFamilyRoomTopology: true });
    expect(advice.status).toBe('EARLY_BIRD_SWEET_SPOT');
    expect(advice.transportAction).toBe('WAIT');
    expect(advice.accommodationAction).toBe('BOOK_NOW_FLEXIBLE');
    expect(advice.reasons).toEqual(['EARLY_BIRD_DISCOUNTS', 'FAMILY_ROOMS_SELL_OUT']);
  });

  it('summer holidays booked by the end of February count as early bird even inside 150 days', () => {
    const june = new Date(2027, 5, 10);
    const early = evaluateBookingTiming({
      startDate: june,
      referenceDate: new Date(2027, 1, 10),
      isSchoolHolidayPeak: true,
      distanceKm: 1800,
      travelMode: 'FLIGHT',
      requiresFamilyRoomTopology: false,
    });
    expect(early.status).toBe('EARLY_BIRD_SWEET_SPOT');
    expect(early.reasons).toContain('SUMMER_EARLY_BIRD_DEADLINE');

    const afterDeadline = evaluateBookingTiming({
      startDate: june,
      referenceDate: new Date(2027, 2, 10),
      isSchoolHolidayPeak: true,
      distanceKm: 1800,
      travelMode: 'FLIGHT',
      requiresFamilyRoomTopology: false,
    });
    expect(afterDeadline.status).toBe('OPTIMAL_BOOKING_WINDOW');
    expect(afterDeadline.reasons).toEqual(['YIELD_DIP', 'PEAK_SCARCITY']);
  });

  it('rail: optimal 60-180 days out, wait before the saver fares open', () => {
    expect(advise({ days: 100, travelMode: 'TRAIN' }).status).toBe('OPTIMAL_BOOKING_WINDOW');
    expect(advise({ days: 100, travelMode: 'TRAIN' }).reasons).toEqual(['RAIL_SAVER_FARES']);
    expect(advise({ days: 250, travelMode: 'TRAIN' }).status).toBe('WAIT_FOR_PRICE_DROP');
  });

  it('car trips have no fares to time; only accommodation matters', () => {
    const offPeak = advise({ days: 200, travelMode: 'CAR' });
    expect(offPeak.status).toBe('OPTIMAL_BOOKING_WINDOW');
    expect(offPeak.transportAction).toBe('NO_FARE_TIMING');
    expect(offPeak.transportWindow).toBeUndefined();
    expect(advise({ days: 5, travelMode: 'CAR' }).status).toBe('OPTIMAL_BOOKING_WINDOW');
    expect(advise({ days: 200, travelMode: 'CAR', isSchoolHolidayPeak: true }).status).toBe('EARLY_BIRD_SWEET_SPOT');
  });

  it('a past departure date counts as zero days, and the time of day does not matter', () => {
    expect(advise({ days: -3 }).daysUntilDeparture).toBe(0);
    const lateEvening = new Date(2026, 9, 25, 23, 30);
    expect(calendarDaysBetween(lateEvening, new Date(2026, 9, 26, 0, 15))).toBe(1);
  });

  it('is deterministic for the same reference date', () => {
    expect(advise({ days: 123, isSchoolHolidayPeak: true })).toEqual(advise({ days: 123, isSchoolHolidayPeak: true }));
  });
});

describe('bookingTimingParamsForCandidate', () => {
  const base = {
    startDate: '2027-07-20',
    endDate: '2027-08-03',
    travelVehicle: 'PLANE',
    flightDistanceKm: 2100,
    pricingDetails: { party: { adults: 2, childrenAges: [4] } },
  } as unknown as CandidateWindow;

  it('derives peak, mode, distance and family-room need from an optimizer result', () => {
    const params = bookingTimingParamsForCandidate({ ...base, schoolHolidayDaysOverlap: 5 });
    expect(params.startDate).toEqual(new Date(2027, 6, 20));
    expect(params.isSchoolHolidayPeak).toBe(true);
    expect(params.travelMode).toBe('FLIGHT');
    expect(params.distanceKm).toBe(2100);
    expect(params.requiresFamilyRoomTopology).toBe(false);
  });

  it('treats high European source-market demand as peak and 2+ children as family-room trips', () => {
    const params = bookingTimingParamsForCandidate({
      ...base,
      sourceMarketDemand: { index: 0.7, marketsOnHoliday: ['DE', 'NL'] },
      pricingDetails: { party: { adults: 2, childrenAges: [4, 9] } },
    } as unknown as CandidateWindow);
    expect(params.isSchoolHolidayPeak).toBe(true);
    expect(params.requiresFamilyRoomTopology).toBe(true);
  });

  it('evaluates a candidate against a given reference date', () => {
    const advice = evaluateBookingTimingForCandidate({ ...base, schoolHolidayDaysOverlap: 14 }, new Date(2026, 11, 1));
    expect(advice.daysUntilDeparture).toBe(231);
    expect(advice.status).toBe('EARLY_BIRD_SWEET_SPOT');
  });
});
