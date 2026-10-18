import { describe, it, expect } from 'vitest';
import {
  validateDestinationInput,
  getDestinationEntity,
  checkRegionalContainment,
  fuzzyMatchDestinationEntity,
  resolveDestinationCodes,
  discoverDestinationsDynamically,
  getDestinationVacationStyles,
} from './destinations';
import {
  isCommercialPassengerAirport,
  getAirportByIata,
  getRecommendedAirportsForCoordinates,
  calculateGeodesicDistanceKm,
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

  it('resolves multilingual international cities and vacation corridors generally', async () => {
    // Munich across German, English, Italian
    const munichDe = await validateDestinationInput('München', 'de');
    expect(munichDe.isValid).toBe(true);
    expect(munichDe.category).toBe('city');
    expect(munichDe.airportCodes).toContain('MUC');

    const munichEn = await validateDestinationInput('Munich', 'en');
    expect(munichEn.isValid).toBe(true);
    expect(munichEn.airportCodes).toContain('MUC');

    // Vienna across German and English
    const viennaDe = await validateDestinationInput('Wien', 'de');
    expect(viennaDe.isValid).toBe(true);
    expect(viennaDe.airportCodes).toContain('VIE');

    // Rome across German, English, Italian
    const romeDe = await validateDestinationInput('Rom', 'de');
    expect(romeDe.isValid).toBe(true);
    expect(romeDe.airportCodes).toContain('FCO');

    // Prague across German, English, Czech
    const pragueDe = await validateDestinationInput('Prag', 'de');
    expect(pragueDe.isValid).toBe(true);
    expect(pragueDe.airportCodes).toContain('PRG');

    // Crete across German, English, French
    const creteDe = await validateDestinationInput('Kreta', 'de');
    expect(creteDe.isValid).toBe(true);
    expect(creteDe.category).toBe('island');
    expect(creteDe.airportCodes).toContain('HER');

    // Algarve
    const algarveRes = await validateDestinationInput('Algarve', 'de');
    expect(algarveRes.isValid).toBe(true);
    expect(algarveRes.category).toBe('region');
    expect(algarveRes.airportCodes).toContain('FAO');
  });

  it('performs resilient fuzzy matching for minor typos across world destinations generally', async () => {
    // Athens typos
    const fuzzyAthens = fuzzyMatchDestinationEntity('Athene', 'de');
    expect(fuzzyAthens).not.toBeNull();
    expect(fuzzyAthens?.id).toBe('athens');

    const fuzzyAten = fuzzyMatchDestinationEntity('Aten', 'de');
    expect(fuzzyAten).not.toBeNull();
    expect(fuzzyAten?.id).toBe('athens');

    // Munich typo (Munchen without umlaut)
    const fuzzyMunich = fuzzyMatchDestinationEntity('Munchen', 'de');
    expect(fuzzyMunich).not.toBeNull();
    expect(fuzzyMunich?.id).toBe('munich');

    // Vienna typo (Viena)
    const fuzzyVienna = fuzzyMatchDestinationEntity('Viena', 'de');
    expect(fuzzyVienna).not.toBeNull();
    expect(fuzzyVienna?.id).toBe('vienna');

    // Rome typo (Romme)
    const fuzzyRome = fuzzyMatchDestinationEntity('Romme', 'de');
    expect(fuzzyRome).not.toBeNull();
    expect(fuzzyRome?.id).toBe('rome');

    // Lisbon (Lissabon)
    const fuzzyLisbon = fuzzyMatchDestinationEntity('Lissabon', 'de');
    expect(fuzzyLisbon).not.toBeNull();
    expect(fuzzyLisbon?.id).toBe('lisbon');
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

describe('Dynamic Vacation Destination Discovery Engine', () => {
  it('discovers balanced destinations dynamically without any hardcoded lists', () => {
    // Default discovery (no tags, default origin) returns dynamic airport codes
    const defaultCodes = resolveDestinationCodes([], 'ALL');
    expect(defaultCodes.length).toBeGreaterThanOrEqual(8);
    // All returned codes must be valid 3-letter IATA codes existing in commercial dataset
    defaultCodes.forEach((code) => {
      expect(code).toHaveLength(3);
      expect(getAirportByIata(code)).toBeDefined();
    });
  });

  it('dynamically adapts discovery to Sydney (Australia / Pacific) without European bias', () => {
    const sydneyResults = resolveDestinationCodes([], 'ALL', {
      departureLat: -33.9,
      departureLon: 151.2,
      originAirports: ['SYD'],
    });

    expect(sydneyResults.length).toBeGreaterThanOrEqual(6);
    // Must feature Pacific / Oceania destinations (e.g. Gold Coast, Queenstown, New Caledonia, Melbourne)
    expect(
      sydneyResults.some((code) => ['OOL', 'MEL', 'HBA', 'ADL', 'ZQN', 'NOU', 'NAN'].includes(code))
    ).toBe(true);
    // Must NOT contain SYD itself
    expect(sydneyResults).not.toContain('SYD');
    // European short-haul destinations must NOT be in Sydney discovery
    expect(sydneyResults).not.toContain('PMI');
    expect(sydneyResults).not.toContain('INN');
  });

  it('dynamically adapts discovery to San Francisco (US West Coast)', () => {
    const sfResults = resolveDestinationCodes([], 'ALL', {
      departureLat: 37.6,
      departureLon: -122.4,
      originAirports: ['SFO'],
    });

    expect(sfResults.length).toBeGreaterThanOrEqual(6);
    // Must contain West Coast / Western destinations (e.g. Reno/Tahoe, Mexico/Baja, Salt Lake, Seattle, Portland)
    expect(
      sfResults.some((code) => ['RNO', 'FAT', 'TIJ', 'BOI', 'PDX', 'SLC', 'SEA'].includes(code))
    ).toBe(true);
    expect(sfResults).not.toContain('SFO');
  });

  it('dynamically adapts discovery to Miami (US East Coast / Caribbean)', () => {
    const miamiResults = resolveDestinationCodes([], 'ALL', {
      departureLat: 25.8,
      departureLon: -80.2,
      originAirports: ['MIA'],
    });

    expect(miamiResults.length).toBeGreaterThanOrEqual(6);
    // Must feature Caribbean / Tropical destinations (e.g. Bahamas, Jamaica, Cancun, Cayman)
    expect(
      miamiResults.some((code) => ['NAS', 'MBJ', 'CUN', 'GCM', 'PLS', 'VRA'].includes(code))
    ).toBe(true);
    expect(miamiResults).not.toContain('MIA');
  });

  it('filters by vacation style dynamically using physical geography and climate', () => {
    // BEACH from Miami yields tropical coastal destinations
    const miamiBeach = resolveDestinationCodes([], 'BEACH', {
      departureLat: 25.8,
      departureLon: -80.2,
      originAirports: ['MIA'],
    });
    expect(miamiBeach.length).toBeGreaterThanOrEqual(5);
    expect(miamiBeach.some((code) => ['NAS', 'MBJ', 'CUN', 'PLS', 'GCM'].includes(code))).toBe(true);

    // ALPINE from Frankfurt yields mountain hubs
    const frankfurtAlpine = resolveDestinationCodes([], 'ALPINE', {
      departureLat: 50.0,
      departureLon: 8.6,
      originAirports: ['FRA'],
    });
    expect(frankfurtAlpine.length).toBeGreaterThanOrEqual(3);
    expect(frankfurtAlpine.some((code) => ['INN', 'ZRH', 'SZG', 'FMM', 'KLV'].includes(code))).toBe(true);
  });

  it('resolves dynamic vacation styles across world destinations with getDestinationVacationStyles', () => {
    // 1. Canary Islands (Tenerife TFS): Beach & Nature
    const tfsStyles = getDestinationVacationStyles('TFS', 3150);
    expect(tfsStyles).toContain('BEACH');

    // 2. Caribbean (Punta Cana PUJ): Beach & Longrange
    const pujStyles = getDestinationVacationStyles('PUJ', 7300);
    expect(pujStyles).toContain('BEACH');
    expect(pujStyles).toContain('LONGRANGE');

    // 3. Alpine (Innsbruck INN): Alpine & Ski
    const innStyles = getDestinationVacationStyles('INN', 320);
    expect(innStyles).toContain('ALPINE');

    // 4. Major Culture City (Rome FCO): City
    const fcoStyles = getDestinationVacationStyles('FCO', 850);
    expect(fcoStyles).toContain('CITY');

    // 5. Inland landlocked cities (Oradea OMR, Vienna VIE): City only, NEVER Beach
    const omrStyles = getDestinationVacationStyles('OMR', 1000);
    expect(omrStyles).toContain('CITY');
    expect(omrStyles).not.toContain('BEACH');

    const vieStyles = getDestinationVacationStyles('VIE', 600);
    expect(vieStyles).toContain('CITY');
    expect(vieStyles).not.toContain('BEACH');
  });

  it('includes Canary Islands (up to 3500km) and Long-range destinations in open flex discovery from Germany', () => {
    const karlsruheResults = resolveDestinationCodes([], 'ALL', {
      departureLat: 49.0069,
      departureLon: 8.4037,
      originAirports: ['FKB', 'STR', 'FRA'],
    });

    const allAp = getAirportByIata('TFS');
    const allCandidates = discoverDestinationsDynamically(['ALL'], {
      departureLat: 49.0069,
      departureLon: 8.4037,
      originAirports: ['FKB', 'STR', 'FRA'],
    });
    expect(karlsruheResults.length).toBeGreaterThanOrEqual(15);

    // 1. Canary Islands (Tenerife, Gran Canaria, Lanzarote, Fuerteventura ~3,100-3,300 km) must be included
    const hasCanary = karlsruheResults.some((code) => ['TFS', 'LPA', 'ACE', 'FUE'].includes(code));
    expect(hasCanary).toBe(true);

    // 2. Long-range & exotic destinations (>3500 km, e.g. Caribbean like SXM/ANU/PUJ/CUN, Gulf/Near East like DXB/DIA/RSI, or Asia like SIN/BKK) must be included
    const hasLongrange = karlsruheResults.some((code) =>
      ['PUJ', 'CUN', 'DXB', 'MLE', 'BKK', 'MBJ', 'SXM', 'ANU', 'SIN', 'DIA', 'RSI', 'BLA'].includes(code)
    );
    expect(hasLongrange).toBe(true);

    // 3. Explicit LONGRANGE style discovery returns predominantly long-haul destinations
    const karlsruheLongrange = resolveDestinationCodes([], 'LONGRANGE', {
      departureLat: 49.0069,
      departureLon: 8.4037,
      originAirports: ['FRA'],
    });
    expect(karlsruheLongrange.length).toBeGreaterThanOrEqual(5);
    expect(
      karlsruheLongrange.some((code) => ['PUJ', 'CUN', 'DXB', 'MLE', 'BKK', 'MBJ', 'SEZ'].includes(code))
    ).toBe(true);
  });
});


