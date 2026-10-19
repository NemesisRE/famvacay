import { describe, it, expect } from 'vitest';
import {
  generateGoogleFlightsLink,
  generateSkyscannerLink,
  generateBookingComLink,
  getFlightDayOfWeekMultiplier,
  getHolidaySurgeMultiplier,
  resolveDestinationBoardType,
  calculateMealPlanDailyValue,
  getSynchronousTripPricing,
  defaultPricingProvider,
} from './pricing-service';

describe('Pricing Service - Deep Links & Estimation Engine', () => {
  it('generates valid Google Flights deep-links with round-trip parameters', () => {
    const link = generateGoogleFlightsLink('FRA', 'PMI', '2026-07-01', '2026-07-10');
    expect(link).toContain('https://www.google.com/travel/flights');
    expect(link).toContain('FRA');
    expect(link).toContain('PMI');
    expect(link).toContain('2026-07-01');
    expect(link).toContain('2026-07-10');
  });

  it('generates Skyscanner deep-links with party composition and formatted dates', () => {
    const link = generateSkyscannerLink('STR', 'BCN', '2026-08-01', '2026-08-15', 2, [5, 8]);
    expect(link).toContain('skyscanner.net/transport/flights');
    expect(link).toContain('str/bcn');
    expect(link).toContain('adultsv2=2');
    expect(link).toContain('childrenv2=5%7C8');
  });

  it('generates Booking.com lodging links with party composition', () => {
    const bookingLink = generateBookingComLink('Palma de Mallorca', '2026-07-01', '2026-07-10', 2, [4]);
    expect(bookingLink).toContain('booking.com/searchresults');
    expect(bookingLink).toContain('checkin=2026-07-01');
    expect(bookingLink).toContain('checkout=2026-07-10');
    expect(bookingLink).toContain('group_adults=2');
    expect(bookingLink).toContain('group_children=1');
  });

  it('computes day of week and holiday surge price multipliers', () => {
    // Friday (mid-weekend surge) vs Tuesday (midweek deal)
    const friMultiplier = getFlightDayOfWeekMultiplier('2026-07-03'); // Friday
    const tueMultiplier = getFlightDayOfWeekMultiplier('2026-07-07'); // Tuesday

    expect(friMultiplier).toBeGreaterThan(tueMultiplier);

    // Easter weekend surge vs normal mid-spring
    const easterSurge = getHolidaySurgeMultiplier('2026-04-03', '2026-04-10');
    expect(easterSurge).toBeGreaterThanOrEqual(1.0);
  });

  it('resolves board types and calculates meal plan daily values across archetypes', () => {
    expect(resolveDestinationBoardType('HRG')).toBe('ALL_INCLUSIVE');
    expect(resolveDestinationBoardType('PMI')).toBe('HALF_BOARD');
    expect(resolveDestinationBoardType('CDG')).toBe('BREAKFAST');

    const ai = calculateMealPlanDailyValue('ALL_INCLUSIVE', 2, [5]);
    const hb = calculateMealPlanDailyValue('HALF_BOARD', 2, [5]);
    const ro = calculateMealPlanDailyValue('ROOM_ONLY', 2, [5]);

    expect(ai.totalDaily).toBeGreaterThan(hb.totalDaily);
    expect(hb.totalDaily).toBeGreaterThan(ro.totalDaily);
    expect(ro.totalDaily).toBe(0);
  });

  it('calculates comprehensive family trip pricing synchronously', () => {
    const pricing = getSynchronousTripPricing({
      originAirport: 'FRA',
      destinationAirport: 'PMI',
      startDate: '2026-07-15',
      endDate: '2026-07-25',
      durationDays: 10,
      party: { adults: 2, childrenAges: [1, 7] }, // 1 infant (<2), 1 child (7)
      preferredBoardType: 'HALF_BOARD',
    });

    expect(pricing).toBeDefined();
    expect(pricing.flight.totalFlightCost).toBeGreaterThan(0);
    expect(pricing.lodging.totalLodgingCost).toBeGreaterThan(0);
    expect(pricing.totalCost).toBeGreaterThan(0);
    expect(pricing.deepLinks.googleFlights).toBeDefined();
    expect(pricing.deepLinks.skyscanner).toBeDefined();
    expect(pricing.party?.adults).toBe(2);
    expect(pricing.party?.childrenAges).toEqual([1, 7]);
  });

  it('provides asynchronous pricing via defaultPricingProvider', async () => {
    const pricing = await defaultPricingProvider.getTripPricing({
      originAirport: 'STR',
      destinationAirport: 'LHR',
      startDate: '2026-09-10',
      endDate: '2026-09-15',
      durationDays: 5,
      party: { adults: 2, childrenAges: [] },
    });

    expect(pricing).toBeDefined();
    expect(pricing.providerSource).toBeDefined();
    expect(pricing.totalCost).toBeGreaterThan(0);
  });
});
