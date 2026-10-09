import { describe, it, expect } from 'vitest';
import {
  TRAVEL_PORTALS,
  getDefaultPortalsForCountry,
  getActivePortals,
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
    const holidayCheck = TRAVEL_PORTALS.find((p) => p.id === 'holidaycheck');
    expect(holidayCheck).toBeDefined();
    const hcUrl = holidayCheck!.buildUrl({
      originAirport: 'FRA',
      destinationAirport: 'PMI',
      startDate: '2026-08-01',
      endDate: '2026-08-15',
    });
    expect(hcUrl).toContain('destination=PMI');
    expect(hcUrl).toContain('departureAirports=FRA');
    expect(hcUrl).toContain('travelDateFrom=2026-08-01');

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
});

