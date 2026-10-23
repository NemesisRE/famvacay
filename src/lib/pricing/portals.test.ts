import { describe, it, expect } from 'vitest';
import {
  TRAVEL_PORTALS,
  getDefaultPortalsForCountry,
} from './portals';

describe('Pluggable Travel Portal Provider Registry', () => {
  it('registers portals across DACH, Oceania, North America, and Global markets', () => {
    const portalIds = TRAVEL_PORTALS.map((p) => p.id);

    // DACH
    expect(portalIds).toContain('holidaycheck');
    expect(portalIds).toContain('check24');
    expect(portalIds).toContain('ab_in_den_urlaub');

    // Oceania
    expect(portalIds).toContain('webjet');
    expect(portalIds).toContain('wotif');

    // North America
    expect(portalIds).toContain('expedia');
    expect(portalIds).toContain('priceline');

    // Global
    expect(portalIds).toContain('google_flights');
    expect(portalIds).toContain('skyscanner');
    expect(portalIds).toContain('kayak');
    expect(portalIds).toContain('booking_com');
  });

  it('selects market-aware default portals based on country of residence', () => {
    const dachDefaults = getDefaultPortalsForCountry('DE');
    expect(dachDefaults).toContain('holidaycheck');
    expect(dachDefaults).toContain('check24');
    expect(dachDefaults).toContain('google_flights');

    const oceaniaDefaults = getDefaultPortalsForCountry('AU');
    expect(oceaniaDefaults).toContain('webjet');
    expect(oceaniaDefaults).toContain('wotif');
    expect(oceaniaDefaults).not.toContain('holidaycheck');

    const usDefaults = getDefaultPortalsForCountry('US');
    expect(usDefaults).toContain('expedia');
    expect(usDefaults).toContain('priceline');
    expect(usDefaults).not.toContain('webjet');
  });

  it('generates accurate search URLs with origin, destination, and dates', () => {
    const webjet = TRAVEL_PORTALS.find((p) => p.id === 'webjet');
    expect(webjet).toBeDefined();
    const wjUrl = webjet!.buildUrl({
      originAirport: 'SYD',
      destinationAirport: 'DPS',
      startDate: '2026-09-10',
      endDate: '2026-09-24',
    });
    expect(wjUrl).toContain('from=SYD');
    expect(wjUrl).toContain('to=DPS');
    expect(wjUrl).toContain('depart=2026-09-10');
  });

  it('links HolidayCheck to its real /ah endpoint with all selected departure airports, dates, and room allocation', () => {
    // HolidayCheck's per-hotel deal links require an internal destination
    // UUID we have no mapping for, but /ah without `destinations` is a
    // confirmed-working destination-less browse filtered by airport/dates.
    const holidayCheck = TRAVEL_PORTALS.find((p) => p.id === 'holidaycheck');
    expect(holidayCheck).toBeDefined();
    const hcUrl = holidayCheck!.buildUrl({
      originAirport: 'FRA',
      originAirports: ['FRA', 'STR', 'FKB'],
      destinationAirport: 'PMI',
      startDate: '2026-08-01',
      endDate: '2026-08-15',
      adults: 2,
    });
    expect(hcUrl).toContain('https://www.holidaycheck.de/ah?');
    expect(hcUrl).toContain('airport=fra-str-fkb');
    expect(hcUrl).toContain('departuredate=2026-08-01');
    expect(hcUrl).toContain('returndate=2026-08-15');
    expect(hcUrl).toContain(`rooms=${encodeURIComponent('a-a')}`);
    expect(hcUrl).toContain('travelkind=package');

    // Falls back to the single originAirport when no full list is given.
    const fallbackUrl = holidayCheck!.buildUrl({
      originAirport: 'FRA',
      destinationAirport: 'PMI',
      startDate: '2026-08-01',
      endDate: '2026-08-15',
    });
    expect(fallbackUrl).toContain('airport=fra');

    // Each child is encoded as its own age, not a headcount, e.g. "a-a-3".
    const withChildUrl = holidayCheck!.buildUrl({
      originAirport: 'FRA',
      destinationAirport: 'PMI',
      startDate: '2026-08-01',
      endDate: '2026-08-15',
      adults: 2,
      childrenAges: [3],
    });
    expect(withChildUrl).toContain(`rooms=${encodeURIComponent('a-a-3')}`);
  });

  it('links CHECK24 to its real /suche/region endpoint with all selected departure airports, dates, duration, and room allocation', () => {
    const check24 = TRAVEL_PORTALS.find((p) => p.id === 'check24');
    expect(check24).toBeDefined();
    const c24Url = check24!.buildUrl({
      originAirport: 'FRA',
      originAirports: ['FRA', 'STR', 'FKB'],
      destinationAirport: 'PMI',
      startDate: '2026-08-01',
      endDate: '2026-08-15',
      adults: 2,
    });
    expect(c24Url).toContain('https://urlaub.check24.de/suche/region?');
    expect(c24Url).toContain(`airport=${encodeURIComponent('FRA,STR,FKB')}`);
    expect(c24Url).toContain('transportType=flight');
    expect(c24Url).toContain(`roomAllocation=${encodeURIComponent('A-A')}`);
    expect(c24Url).toContain('departureDate=2026-08-01');
    expect(c24Url).toContain('returnDate=2026-08-15');
    expect(c24Url).toContain('days=exact');
    expect(c24Url).toContain('sorting=categoryDistribution');

    // Falls back to the single originAirport when no full list is given.
    const fallbackUrl = check24!.buildUrl({
      originAirport: 'FRA',
      destinationAirport: 'PMI',
      startDate: '2026-08-01',
      endDate: '2026-08-15',
    });
    expect(fallbackUrl).toContain('airport=FRA');

    // Each child is encoded as its own age, not a headcount, e.g. "A-A-3".
    const withChildUrl = check24!.buildUrl({
      originAirport: 'FRA',
      destinationAirport: 'PMI',
      startDate: '2026-08-01',
      endDate: '2026-08-15',
      adults: 2,
      childrenAges: [3],
    });
    expect(withChildUrl).toContain(`roomAllocation=${encodeURIComponent('A-A-3')}`);
  });

  it('links ab-in-den-urlaub to its real /find/hotels results endpoint with date and duration filters', () => {
    const abInDenUrlaub = TRAVEL_PORTALS.find((p) => p.id === 'ab_in_den_urlaub');
    expect(abInDenUrlaub).toBeDefined();
    const url = abInDenUrlaub!.buildUrl({
      originAirport: 'FRA',
      destinationAirport: 'PMI',
      startDate: '2026-08-01',
      endDate: '2026-08-15',
      adults: 2,
    });
    expect(url).toContain('https://www.ab-in-den-urlaub.de/find/hotels?');
    expect(url).toContain('dateMin=2026-08-01');
    expect(url).toContain('dateMax=2026-08-15');
    expect(url).toContain('durationMin=14');
    expect(url).toContain('durationMax=14');
    expect(url).toContain('adults=2');
    expect(url).toContain('travelType=packageTour');
  });
});

