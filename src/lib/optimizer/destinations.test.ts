import { describe, it, expect } from 'vitest';
import {
  validateDestinationInput,
  getDestinationEntity,
  checkRegionalContainment,
  fuzzyMatchDestinationEntity,
  resolveDestinationCodes,
} from './destinations';
import {
  isCommercialPassengerAirport,
  getAirportByIata,
  getRecommendedAirportsForCoordinates,
} from '../airports/airport-service';
import { getEstimatedClimate } from './weather';
import {
  generateGoogleFlightsLink,
  generateSkyscannerLink,
  generateBookingComLink,
  PortalAggregatorProvider,
} from '../pricing/pricing-service';

describe('Destination Fuzzy Search, Recognition & Containment', () => {
  it('resolves multilingual city names for Athens (Athen, Athens, Athènes)', async () => {
    const resDe = await validateDestinationInput('Athen', 'de');
    expect(resDe.isValid).toBe(true);
    expect(resDe.category).toBe('city');
    expect(resDe.airportCodes).toContain('ATH');

    const resEn = await validateDestinationInput('Athens', 'en');
    expect(resEn.isValid).toBe(true);
    expect(resEn.airportCodes).toContain('ATH');

    const resFr = await validateDestinationInput('Athènes', 'fr');
    expect(resFr.isValid).toBe(true);
    expect(resFr.airportCodes).toContain('ATH');
  });

  it('performs resilient fuzzy matching for minor typos (e.g. Aten, Athene)', async () => {
    const fuzzy = fuzzyMatchDestinationEntity('Athene', 'de');
    expect(fuzzy).not.toBeNull();
    expect(fuzzy?.id).toBe('athens');
  });

  it('detects regional containment when child city is added while parent region is selected', async () => {
    // Adding Palma when Mallorca is already active
    const containmentPalma = checkRegionalContainment('Palma', ['Mallorca (Balearen)'], 'de');
    expect(containmentPalma.isContained).toBe(true);
    expect(containmentPalma.parentTag).toBe('Mallorca (Balearen)');

    // Adding Hurghada City when Red Sea is active
    const containmentHrg = checkRegionalContainment('Hurghada City', ['Hurghada & Rotes Meer'], 'de');
    expect(containmentHrg.isContained).toBe(true);

    // Adding Athens when Greece is active
    const containmentAthens = checkRegionalContainment('Athens', ['Griechenland'], 'de');
    expect(containmentAthens.isContained).toBe(true);

    // Completely separate destination is not contained
    const containmentTokyo = checkRegionalContainment('Tokyo', ['Mallorca (Balearen)'], 'de');
    expect(containmentTokyo.isContained).toBe(false);
  });

  it('strictly rejects unknown or fictitious inputs (e.g. "Mars")', async () => {
    const marsRes = await validateDestinationInput('Mars', 'de');
    expect(marsRes.isValid).toBe(false);

    const atlantisRes = await validateDestinationInput('AtlantisCity123', 'de');
    expect(atlantisRes.isValid).toBe(false);
  });
});

describe('Commercial Passenger Airport Filtering', () => {
  it('strictly excludes military airbases', () => {
    // Ramstein Air Base
    expect(isCommercialPassengerAirport({ code: 'RMS', name: 'Ramstein Air Base' })).toBe(false);
    // Spangdahlem Air Base
    expect(isCommercialPassengerAirport({ code: 'SPM', name: 'Spangdahlem Air Base' })).toBe(false);
    // Geilenkirchen
    expect(isCommercialPassengerAirport({ code: 'GKE', name: 'Geilenkirchen Air Base' })).toBe(false);
  });

  it('strictly excludes glider fields and private airfields', () => {
    // Egelsbach
    expect(isCommercialPassengerAirport({ code: 'QEF', name: 'Frankfurt-Egelsbach Airport' })).toBe(false);
    // Speyer
    expect(isCommercialPassengerAirport({ code: 'ZQC', name: 'Speyer Airfield' })).toBe(false);
    // Keyword exclusion
    expect(isCommercialPassengerAirport({ code: 'XYZ', name: 'Wasserkuppe Segelflugplatz' })).toBe(false);
  });

  it('preserves certified commercial passenger airline hubs', () => {
    expect(isCommercialPassengerAirport({ code: 'FRA', name: 'Frankfurt am Main International Airport' })).toBe(true);
    expect(isCommercialPassengerAirport({ code: 'MUC', name: 'Munich Airport' })).toBe(true);
    expect(isCommercialPassengerAirport({ code: 'STR', name: 'Stuttgart Airport' })).toBe(true);
    expect(isCommercialPassengerAirport({ code: 'FKB', name: 'Karlsruhe / Baden-Baden' })).toBe(true);
    expect(isCommercialPassengerAirport({ code: 'CDG', name: 'Paris Charles de Gaulle' })).toBe(true);
  });

  it('recommended airports do not contain excluded military or private airfields', () => {
    // Coordinates near Karlsruhe / Ramstein (lat: 49.0, lon: 8.4)
    const recs = getRecommendedAirportsForCoordinates(49.0, 8.4, 300);
    const codes = recs.map((r) => r.code);
    expect(codes).not.toContain('RMS');
    expect(codes).not.toContain('SPM');
    expect(codes).not.toContain('QEF');
    expect(codes).toContain('FKB');
    expect(codes).toContain('STR');
    expect(codes).toContain('FRA');
  });
});

describe('Climate Assessment Metrics', () => {
  it('returns complete air, water, rain, and sunshine metrics', () => {
    // Mallorca in July (month 6)
    const summerPalma = getEstimatedClimate('PMI', 6);
    expect(summerPalma.avgTempC).toBeGreaterThanOrEqual(26);
    expect(summerPalma.maxTempC).toBeGreaterThan(summerPalma.avgTempC);
    expect(summerPalma.minTempC).toBeLessThan(summerPalma.avgTempC);
    expect(summerPalma.waterTempC).toBeGreaterThanOrEqual(23); // Coastal sea water
    expect(summerPalma.sunshineHoursPerDay).toBeGreaterThanOrEqual(10);
    expect(summerPalma.rainyDays).toBeLessThanOrEqual(5);

    // Vienna (Inland city) in summer
    const summerVienna = getEstimatedClimate('VIE', 6);
    expect(summerVienna.waterTempC).toBeNull(); // Inland city has no sea temp
    expect(summerVienna.sunshineHoursPerDay).toBeGreaterThanOrEqual(8);
  });
});

describe('Pricing Provider & Deep-Links', () => {
  it('generates valid Google Flights, Skyscanner, and Booking.com deep links', () => {
    const gf = generateGoogleFlightsLink('FRA', 'PMI', '2026-07-15', '2026-07-25');
    expect(gf).toContain('Flights%20to%20PMI%20from%20FRA');
    expect(gf).toContain('2026-07-15');

    const sky = generateSkyscannerLink('FRA', 'PMI', '2026-07-15', '2026-07-25', 2, [7, 10]);
    expect(sky).toContain('fra/pmi');
    expect(sky).toContain('adultsv2=2');
    expect(sky).toContain('childrenv2=7%7C10');

    const booking = generateBookingComLink('Palma de Mallorca', '2026-07-15', '2026-07-25', 2, [7, 10]);
    expect(booking).toContain('checkin=2026-07-15');
    expect(booking).toContain('group_adults=2');
    expect(booking).toContain('group_children=2');
  });

  it('aggregates realistic flight and lodging rates with party tiers', async () => {
    const provider = new PortalAggregatorProvider();
    const pricing = await provider.getTripPricing({
      originAirport: 'STR',
      destinationAirport: 'PMI',
      startDate: '2026-07-10',
      endDate: '2026-07-20',
      durationDays: 10,
      party: {
        adults: 2,
        childrenAges: [5, 8],
        cabinClass: 'ECONOMY',
      },
    });

    expect(pricing.flight.totalFlightCost).toBeGreaterThan(500);
    expect(pricing.lodging.totalLodgingCost).toBeGreaterThan(800);
    expect(pricing.totalCost).toBe(pricing.flight.totalFlightCost + pricing.lodging.totalLodgingCost);
    expect(pricing.deepLinks.googleFlights).toBeDefined();
    expect(pricing.deepLinks.bookingCom).toBeDefined();
  });
});

