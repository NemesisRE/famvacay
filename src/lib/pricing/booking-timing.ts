import type { CandidateWindow } from '../optimizer/types';

/**
 * Booking lead-time advisor: tells a family *when* to book a recommended trip, from the days left
 * until departure, school-holiday peak vs. off-peak, haul length, transport mode and whether the
 * party needs a family room or apartment.
 *
 * Pure and deterministic: the same inputs (including `referenceDate`) always give the same advice.
 * The thresholds are rules of thumb from airline/rail booking horizons and tour-operator early-bird
 * seasons, not live price data; the UI presents them as guidance.
 */

export type BookingTravelMode = 'FLIGHT' | 'CAR' | 'TRAIN' | 'BUS';

export type BookingTimingStatus =
  | 'TOO_EARLY_SCHEDULE_LOCKED'
  | 'EARLY_BIRD_SWEET_SPOT'
  | 'OPTIMAL_BOOKING_WINDOW'
  | 'WAIT_FOR_PRICE_DROP'
  | 'HIGH_URGENCY_SCARCITY'
  | 'LAST_MINUTE_GAMBLE';

/** What to do about the journey itself (flights, train or coach tickets; a car has no fares) */
export type TransportBookingAction =
  | 'NOT_YET_BOOKABLE'
  | 'BOOK_NOW'
  | 'BOOK_IMMEDIATELY'
  | 'WAIT'
  | 'CHECK_PACKAGES'
  | 'NO_FARE_TIMING';

/** What to do about accommodation */
export type AccommodationBookingAction =
  | 'BOOK_NOW_FLEXIBLE'
  | 'BOOK_NOW'
  | 'BOOK_IMMEDIATELY'
  | 'RESERVE_REFUNDABLE'
  | 'NO_RUSH'
  | 'COMPARE_PACKAGES';

/** Why the advice applies to this trip; each maps to one explanation in the UI */
export type BookingTimingReason =
  | 'SCHEDULE_NOT_RELEASED'
  | 'RAIL_TIMETABLE_NOT_OPEN'
  | 'ACCOMMODATION_NOT_OPEN'
  | 'EARLY_BIRD_DISCOUNTS'
  | 'SUMMER_EARLY_BIRD_DEADLINE'
  | 'FAMILY_ROOMS_SELL_OUT'
  | 'PEAK_SCARCITY'
  | 'LONG_HAUL_FARES'
  | 'YIELD_DIP'
  | 'RAIL_SAVER_FARES'
  | 'NO_SCARCITY_OFF_PEAK'
  | 'FARES_RISING'
  | 'LATE_FARE_SPIKE'
  | 'LAST_MINUTE_PACKAGES'
  | 'NO_FARE_DYNAMICS';

export type BookingTimingTone = 'positive' | 'caution' | 'urgent' | 'neutral';

/** Days before departure, `fromDaysBefore` >= `toDaysBefore` (e.g. 140 down to 45) */
export interface BookingLeadWindow {
  fromDaysBefore: number;
  toDaysBefore: number;
}

export interface BookingTimingParams {
  startDate: Date;
  /** "Today"; defaults to the current date */
  referenceDate?: Date;
  /** The window overlaps school holidays (summer, Christmas, Easter, ...) */
  isSchoolHolidayPeak: boolean;
  /** One-way travel distance */
  distanceKm: number;
  travelMode: BookingTravelMode;
  /** 2+ children or 5+ travellers: needs a family room, suite or apartment */
  requiresFamilyRoomTopology: boolean;
}

export interface BookingTimingAdvice {
  status: BookingTimingStatus;
  tone: BookingTimingTone;
  daysUntilDeparture: number;
  isLongHaul: boolean;
  isSchoolHolidayPeak: boolean;
  requiresFamilyRoomTopology: boolean;
  travelMode: BookingTravelMode;
  transportAction: TransportBookingAction;
  /** Best lead-time window for the journey itself; absent for car trips */
  transportWindow?: BookingLeadWindow;
  accommodationAction: AccommodationBookingAction;
  reasons: BookingTimingReason[];
}

export const LONG_HAUL_THRESHOLD_KM = 4000;

/** Airlines publish schedules ~11 months ahead; rail and coach timetables and most hotels ~a year */
const FLIGHT_BOOKING_HORIZON_DAYS = 330;
const OVERLAND_BOOKING_HORIZON_DAYS = 365;
const EARLY_BIRD_WINDOW: BookingLeadWindow = { fromDaysBefore: 300, toDaysBefore: 150 };
/** School holidays: affordable family rooms and seats run out inside ~6 weeks */
const PEAK_URGENCY_DAYS = 44;
/** Inside 3 weeks fares jump to late-booking price levels */
const LATE_FARE_DAYS = 21;
const LAST_MINUTE_DAYS = 14;

/** Typical lowest-price lead times per mode (days before departure) */
const OPTIMAL_WINDOWS = {
  shortHaulFlight: { fromDaysBefore: 140, toDaysBefore: 45 },
  longHaulFlight: { fromDaysBefore: 210, toDaysBefore: 90 },
  rail: { fromDaysBefore: 180, toDaysBefore: 60 },
  coach: { fromDaysBefore: 120, toDaysBefore: 30 },
} as const satisfies Record<string, BookingLeadWindow>;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole calendar days between two dates, ignoring the time of day and DST shifts */
export function calendarDaysBetween(from: Date, to: Date): number {
  const fromUtc = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const toUtc = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((toUtc - fromUtc) / DAY_MS);
}

function optimalTransportWindow(mode: BookingTravelMode, isLongHaul: boolean): BookingLeadWindow | undefined {
  switch (mode) {
    case 'FLIGHT':
      return isLongHaul ? OPTIMAL_WINDOWS.longHaulFlight : OPTIMAL_WINDOWS.shortHaulFlight;
    case 'TRAIN':
      return OPTIMAL_WINDOWS.rail;
    case 'BUS':
      return OPTIMAL_WINDOWS.coach;
    case 'CAR':
      return undefined;
  }
}

function within(days: number, window: BookingLeadWindow): boolean {
  return days <= window.fromDaysBefore && days >= window.toDaysBefore;
}

/**
 * Summer school holidays (departure June-September) booked by the end of February of the same
 * year: DACH tour operators' main early-booking season.
 */
function isBeforeSummerEarlyBirdDeadline(startDate: Date, referenceDate: Date): boolean {
  const month = startDate.getMonth();
  if (month < 5 || month > 8) return false;
  const deadline = new Date(startDate.getFullYear(), 2, 0); // last day of February
  return calendarDaysBetween(referenceDate, deadline) >= 0;
}

function toneFor(status: BookingTimingStatus): BookingTimingTone {
  switch (status) {
    case 'EARLY_BIRD_SWEET_SPOT':
    case 'OPTIMAL_BOOKING_WINDOW':
      return 'positive';
    case 'WAIT_FOR_PRICE_DROP':
    case 'LAST_MINUTE_GAMBLE':
      return 'caution';
    case 'HIGH_URGENCY_SCARCITY':
      return 'urgent';
    case 'TOO_EARLY_SCHEDULE_LOCKED':
      return 'neutral';
  }
}

export function evaluateBookingTiming(params: BookingTimingParams): BookingTimingAdvice {
  const referenceDate = params.referenceDate ?? new Date();
  const { travelMode, isSchoolHolidayPeak: peak, requiresFamilyRoomTopology: familyRoom } = params;
  const days = Math.max(0, calendarDaysBetween(referenceDate, params.startDate));
  const isLongHaul = travelMode === 'FLIGHT' && params.distanceKm >= LONG_HAUL_THRESHOLD_KM;
  const hasFares = travelMode !== 'CAR';
  const window = optimalTransportWindow(travelMode, isLongHaul);

  const advise = (
    status: BookingTimingStatus,
    transportAction: TransportBookingAction,
    accommodationAction: AccommodationBookingAction,
    reasons: (BookingTimingReason | false)[]
  ): BookingTimingAdvice => ({
    status,
    tone: toneFor(status),
    daysUntilDeparture: days,
    isLongHaul,
    isSchoolHolidayPeak: peak,
    requiresFamilyRoomTopology: familyRoom,
    travelMode,
    transportAction: hasFares ? transportAction : 'NO_FARE_TIMING',
    transportWindow: window,
    accommodationAction,
    reasons: reasons.filter((r): r is BookingTimingReason => r !== false),
  });

  // 1. Beyond the booking horizon: schedules and timetables are not (fully) published yet
  const horizon = travelMode === 'FLIGHT' ? FLIGHT_BOOKING_HORIZON_DAYS : OVERLAND_BOOKING_HORIZON_DAYS;
  if (days > horizon) {
    return advise('TOO_EARLY_SCHEDULE_LOCKED', 'NOT_YET_BOOKABLE', peak || familyRoom ? 'RESERVE_REFUNDABLE' : 'NO_RUSH', [
      travelMode === 'FLIGHT' ? 'SCHEDULE_NOT_RELEASED' : hasFares ? 'RAIL_TIMETABLE_NOT_OPEN' : 'ACCOMMODATION_NOT_OPEN',
      familyRoom && 'FAMILY_ROOMS_SELL_OUT',
    ]);
  }

  // 2. School holidays inside ~6 weeks: whatever is left is getting scarce and expensive
  if (peak && days <= PEAK_URGENCY_DAYS) {
    return advise('HIGH_URGENCY_SCARCITY', 'BOOK_IMMEDIATELY', 'BOOK_IMMEDIATELY', [
      'PEAK_SCARCITY',
      hasFares && days < LATE_FARE_DAYS && 'LATE_FARE_SPIKE',
      familyRoom && 'FAMILY_ROOMS_SELL_OUT',
    ]);
  }

  // 3. Off-peak, under two weeks: flight-only fares are at business levels, but tour operators
  //    sell leftover charter seats + hotel as discounted package deals
  if (days < LAST_MINUTE_DAYS && travelMode === 'FLIGHT') {
    return advise('LAST_MINUTE_GAMBLE', 'CHECK_PACKAGES', 'COMPARE_PACKAGES', ['LAST_MINUTE_PACKAGES']);
  }

  // 4. Any fare inside three weeks
  if (hasFares && days < LATE_FARE_DAYS) {
    return advise('HIGH_URGENCY_SCARCITY', 'BOOK_IMMEDIATELY', 'BOOK_NOW', ['LATE_FARE_SPIKE']);
  }

  // 5. Early-bird season: school holidays and long-haul 5-10 months out, summer holidays booked by
  //    the end of February, and families needing a family room (those sell out first)
  const summerDeadline = peak && isBeforeSummerEarlyBirdDeadline(params.startDate, referenceDate);
  const earlyBirdAge = within(days, EARLY_BIRD_WINDOW);
  const beyondTransportWindow = window ? days > window.fromDaysBefore : false;
  const familyRoomEarly = familyRoom && (earlyBirdAge || beyondTransportWindow);
  if (((peak || isLongHaul) && earlyBirdAge) || summerDeadline || familyRoomEarly || (peak && beyondTransportWindow)) {
    // Off-peak short-haul fares are still cheaper later; only the room should be secured now
    const transportNow = peak || isLongHaul || !window || !beyondTransportWindow;
    return advise('EARLY_BIRD_SWEET_SPOT', transportNow ? 'BOOK_NOW' : 'WAIT', 'BOOK_NOW_FLEXIBLE', [
      (peak || familyRoom) && 'EARLY_BIRD_DISCOUNTS',
      summerDeadline && 'SUMMER_EARLY_BIRD_DEADLINE',
      familyRoom && 'FAMILY_ROOMS_SELL_OUT',
      isLongHaul && 'LONG_HAUL_FARES',
    ]);
  }

  // 6. Car trips: no fares to time, only accommodation
  if (!window) {
    return advise('OPTIMAL_BOOKING_WINDOW', 'NO_FARE_TIMING', 'BOOK_NOW', ['NO_FARE_DYNAMICS', peak && 'PEAK_SCARCITY']);
  }

  // 7. Inside the mode's lowest-price window
  if (within(days, window)) {
    return advise('OPTIMAL_BOOKING_WINDOW', 'BOOK_NOW', 'BOOK_NOW', [
      travelMode === 'FLIGHT' ? 'YIELD_DIP' : 'RAIL_SAVER_FARES',
      peak && 'PEAK_SCARCITY',
    ]);
  }

  // 8. Too early for the best fares (off-peak, no family-room pressure): monitor and wait
  if (beyondTransportWindow) {
    return advise('WAIT_FOR_PRICE_DROP', 'WAIT', 'RESERVE_REFUNDABLE', [
      travelMode === 'FLIGHT' ? 'NO_SCARCITY_OFF_PEAK' : 'RAIL_TIMETABLE_NOT_OPEN',
    ]);
  }

  // 9. Past the lowest-price window: fares are already climbing
  return advise('HIGH_URGENCY_SCARCITY', 'BOOK_IMMEDIATELY', 'BOOK_NOW', ['FARES_RISING']);
}

const BOOKING_MODE_BY_VEHICLE = {
  PLANE: 'FLIGHT',
  CAR: 'CAR',
  TRAIN: 'TRAIN',
  BUS: 'BUS',
} as const satisfies Record<NonNullable<CandidateWindow['travelVehicle']>, BookingTravelMode>;

/** Share of Europe's big source markets on school holidays that counts as peak season */
const SOURCE_MARKET_PEAK_INDEX = 0.5;

/** Advisor inputs for an optimizer result (everything except the reference date) */
export function bookingTimingParamsForCandidate(win: CandidateWindow): Omit<BookingTimingParams, 'referenceDate'> {
  const [year, month, day] = win.startDate.split('-').map(Number);
  const party = win.pricingDetails?.party;
  const children = party?.childrenAges.length ?? 0;
  const travellers = (party?.adults ?? 2) + children;
  return {
    startDate: new Date(year, month - 1, day),
    isSchoolHolidayPeak:
      (win.schoolHolidayDaysOverlap ?? 0) > 0 || (win.sourceMarketDemand?.index ?? 0) >= SOURCE_MARKET_PEAK_INDEX,
    distanceKm: win.flightDistanceKm ?? win.vehicleDetails?.distanceKm ?? 0,
    travelMode: BOOKING_MODE_BY_VEHICLE[win.travelVehicle ?? 'PLANE'],
    requiresFamilyRoomTopology: children >= 2 || travellers >= 5,
  };
}

export function evaluateBookingTimingForCandidate(win: CandidateWindow, referenceDate?: Date): BookingTimingAdvice {
  return evaluateBookingTiming({ ...bookingTimingParamsForCandidate(win), referenceDate });
}
