import { describe, it, expect } from 'vitest';
import { getDistance } from 'geolib';
import { optimizeVacationWindows, OVERLAND_ORIGIN_CODE } from '../engine';
import { resolveDestinationCodes, resolveOverlandRangeKm } from '../destinations';
import {
  classifyOverlandAccess,
  isOverlandReachable,
  calculateOverlandFrictionScore,
  maxGeodesicKmForMinutes,
  calculateVehicleMetrics,
} from '../vehicles';
import { getDestinationVacationStyles } from '../destination-styles';
import { getDestinationPoint } from '../../geo/destination-points';
import { SURFACE_DESTINATIONS, isSurfaceDestinationCode } from '../../geo/surface-destinations';
import { calculateGeodesicDistanceKm, getAirportByIata } from '../../airports/airport-service';
import { resolveFlightRoute } from '../../airports/flight-routes';
import type { TripPlanInput, TravelVehicle } from '../types';

const KARLSRUHE = {
  homeLocation: 'Karlsruhe, Germany',
  departureLat: 49.0069,
  departureLon: 8.4037,
  federalState: 'DE-BW',
  originAirports: ['STR', 'FKB', 'FRA'],
  childrenAges: [5, 9],
  blackoutRanges: [],
};

const overlandContext = (vehicles: TravelVehicle[], extra: Record<string, unknown> = {}) => ({
  departureLat: KARLSRUHE.departureLat,
  departureLon: KARLSRUHE.departureLon,
  country: 'DE',
  federalState: 'DE-BW',
  originAirports: KARLSRUHE.originAirports,
  travelVehicles: vehicles,
  earliestDate: '2027-07-25',
  latestDate: '2027-09-05',
  ...extra,
});

const countryOf = (code: string) => getDestinationPoint(code)?.country;

describe('Overland discovery: decoupled from airports, diverse across countries', () => {
  it('a road-trip beach search reaches Spain, Portugal and ferry islands, not just the airport towns', () => {
    const codes = resolveDestinationCodes(undefined, ['BEACH'], overlandContext(['CAR']));
    const countries = new Set(codes.map(countryOf));

    expect(codes.length).toBeGreaterThanOrEqual(25);
    expect(countries.size).toBeGreaterThanOrEqual(10);
    expect(countries).toContain('Spain');
    expect(countries).toContain('Portugal');
    // Non-airport surface nodes are indexed organically
    expect(codes.filter(isSurfaceDestinationCode).length).toBeGreaterThanOrEqual(15);
    // Ferry-accessible islands are included
    expect(codes.some((c) => getDestinationPoint(c)?.surface?.access === 'SHORT_FERRY' || getDestinationPoint(c)?.surface?.access === 'LONG_FERRY')).toBe(true);
    // No country may monopolise the pool
    const perCountry = new Map<string, number>();
    for (const c of codes) perCountry.set(countryOf(c)!, (perCountry.get(countryOf(c)!) || 0) + 1);
    expect(Math.max(...perCountry.values())).toBeLessThanOrEqual(4);
  });

  it('never offers flight-only islands without a modeled ferry for overland trips', () => {
    const codes = resolveDestinationCodes(undefined, ['BEACH'], overlandContext(['CAR', 'TRAIN', 'BUS']));
    for (const code of ['JSY', 'JNX', 'JMK', 'COL', 'BRR', 'PMI', 'TFS']) {
      expect(codes).not.toContain(code);
    }
  });

  it('honors the overland travel-time cap when choosing the discovery radius', () => {
    expect(resolveOverlandRangeKm(['CAR'], 6 * 60)).toBeCloseTo(maxGeodesicKmForMinutes('CAR', 6 * 60), 5);
    const codes = resolveDestinationCodes(undefined, ['BEACH'], overlandContext(['CAR'], { maxOverlandTravelMinutes: 6 * 60 }));
    for (const code of codes) {
      const p = getDestinationPoint(code)!;
      const dist = calculateGeodesicDistanceKm(KARLSRUHE.departureLat, KARLSRUHE.departureLon, p.lat, p.lon);
      expect(dist).toBeLessThanOrEqual(maxGeodesicKmForMinutes('CAR', 6 * 60) + 1);
    }
  });

  it('resolves destination tags to surface nodes (region and country names) for overland trips', () => {
    const algarve = resolveDestinationCodes(['Algarve'], ['ALL'], overlandContext(['CAR']));
    expect(algarve).toEqual(expect.arrayContaining(['srf:albufeira', 'srf:lagos']));

    const croatia = resolveDestinationCodes(['Croatia'], ['ALL'], overlandContext(['CAR']));
    expect(croatia).toEqual(expect.arrayContaining(['srf:porec', 'srf:rovinj']));
  });

  it('surface nodes carry their curated styles instead of airport heuristics', () => {
    expect(getDestinationVacationStyles('srf:lloret-de-mar')).toEqual(expect.arrayContaining(['BEACH']));
    expect(getDestinationVacationStyles('srf:zell-am-see')).toEqual(expect.arrayContaining(['ALPINE']));
    expect(getDestinationVacationStyles('srf:zell-am-see')).not.toContain('BEACH');
  });

  it('every surface node resolves to a destination point with a valid region code', () => {
    for (const s of SURFACE_DESTINATIONS) {
      const p = getDestinationPoint(s.code);
      expect(p?.kind).toBe('SURFACE');
      expect(s.state).toMatch(/^[A-Z]{2}-[A-Z0-9]{1,3}$/);
      // Never collides with an airport
      expect(getAirportByIata(s.code)).toBeUndefined();
    }
  });
});

describe('Overland access topology', () => {
  const home = { lat: 49.0069, lon: 8.4037, countryCode: 'DE', state: 'DE-BW' };
  const geo = (code: string) => {
    const p = getDestinationPoint(code)!;
    return { lat: p.lat, lon: p.lon, countryCode: p.state?.split('-')[0], state: p.state, code };
  };

  it('classifies island airports without a ferry model as flight-only', () => {
    expect(classifyOverlandAccess(geo('JSY')).access).toBe('FLIGHT_ONLY'); // Syros
    expect(classifyOverlandAccess(geo('BRR')).access).toBe('FLIGHT_ONLY'); // Barra
    expect(isOverlandReachable(home, geo('JSY'))).toBe(false);
  });

  it('models Sicily, the Channel Islands and the Isle of Man as ferry destinations', () => {
    expect(classifyOverlandAccess(geo('PMO')).access).toBe('SHORT_FERRY');
    expect(classifyOverlandAccess(geo('JER')).access).toBe('SHORT_FERRY');
    expect(classifyOverlandAccess(geo('IOM')).access).toBe('LONG_FERRY');
  });

  it('lets surface island nodes declare their own ferry link (Mallorca via Barcelona)', () => {
    const alcudia = geo('srf:alcudia');
    expect(isOverlandReachable(home, alcudia)).toBe(true);
    const access = classifyOverlandAccess(alcudia);
    expect(access.access).toBe('LONG_FERRY');
    expect(access.ferrySurchargeEur).toBeGreaterThan(0);
  });

  it('scores overland friction by door-to-door duration', () => {
    const short = calculateOverlandFrictionScore('CAR', 3 * 60);
    const long = calculateOverlandFrictionScore('CAR', 14 * 60);
    expect(short).toBeGreaterThan(long);
    expect(calculateOverlandFrictionScore('CAR', 6 * 60, 'LONG_FERRY')).toBeLessThan(calculateOverlandFrictionScore('CAR', 6 * 60));
  });
});

describe('Mode-specific candidate details', () => {
  const baseInput = (vehicles: TravelVehicle[]): TripPlanInput => ({
    destinationTypes: ['BEACH'],
    durationDays: 10,
    earliestDate: '2027-07-25',
    latestDate: '2027-08-20',
    travelVehicles: vehicles,
    userProfile: { ...KARLSRUHE },
  });

  it('overland windows start at home and carry no flight logistics', () => {
    const windows = optimizeVacationWindows(baseInput(['CAR']), {}, {});
    expect(windows.length).toBeGreaterThan(0);
    for (const w of windows) {
      expect(w.travelVehicle).toBe('CAR');
      expect(w.originAirport).toBe(OVERLAND_ORIGIN_CODE);
      expect(w.flightDistanceKm).toBeUndefined();
      expect(w.flightSegments).toBeUndefined();
      expect(w.flightStops).toBeUndefined();
      expect(w.parkSleepFlyRecommended).toBeUndefined();
      expect(w.isArbitrageOpportunity).toBe(false);
      expect(w.pricingDetails?.travelMode).toBe('CAR');
      expect(w.pricingDetails?.flight.segments).toBeUndefined();
      expect(w.pricingDetails?.packageTourDeal).toBeUndefined();
      expect(w.pricingDetails?.deepLinks.googleFlights).toBe('');
      expect(w.vehicleDetails?.durationMinutes).toBeGreaterThan(0);
      expect(w.estimatedTotalCost).toBe(
        (w.vehicleDetails?.estimatedTravelCost || 0) + (w.pricingDetails?.lodging.totalLodgingCost || 0)
      );
    }
  });

  it('emits one overland candidate per window instead of one per departure airport', () => {
    const windows = optimizeVacationWindows({ ...baseInput(['CAR']), maxWindowsPerDestination: 0 }, {}, {});
    const keys = windows.map((w) => `${w.destinationAirport}|${w.startDate}|${w.durationDays}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('surface destinations get lodging links by place name, not by a fake airport code', () => {
    const windows = optimizeVacationWindows({ ...baseInput(['CAR']), targetDestinations: ['Algarve'] }, {}, {});
    const surface = windows.find((w) => isSurfaceDestinationCode(w.destinationAirport));
    expect(surface).toBeDefined();
    expect(surface!.destinationCountry).toBe('Portugal');
    expect(surface!.pricingDetails?.deepLinks.bookingCom).not.toContain('srf');
  });

  it('flight windows keep their flight details and travel mode', () => {
    const windows = optimizeVacationWindows({ ...baseInput(['PLANE']), targetDestinations: ['PMI'] }, {}, {});
    expect(windows.length).toBeGreaterThan(0);
    for (const w of windows) {
      expect(w.travelVehicle).toBe('PLANE');
      expect(w.flightDistanceKm).toBeGreaterThan(0);
      expect(w.pricingDetails?.travelMode).toBe('PLANE');
      expect((w as any).flightRoute).toBeUndefined(); // internal routing object must not leak into the payload
    }
  });

  it('car metrics model the road distance from home, not from an airport', () => {
    const p = getDestinationPoint('srf:lloret-de-mar')!;
    const geodesic = calculateGeodesicDistanceKm(KARLSRUHE.departureLat, KARLSRUHE.departureLon, p.lat, p.lon);
    const windows = optimizeVacationWindows({ ...baseInput(['CAR']), targetDestinations: ['Lloret de Mar'] }, {}, {});
    const w = windows.find((x) => x.destinationAirport === 'srf:lloret-de-mar');
    expect(w).toBeDefined();
    expect(w!.vehicleDetails!.distanceKm).toBe(calculateVehicleMetrics('CAR', geodesic).distanceKm);
  });
});

describe('Hot-path primitives', () => {
  it('geodesic distance matches geolib exactly', () => {
    const pairs: [number, number, number, number][] = [
      [49.0069, 8.4037, 39.5517, 2.7388],
      [48.6899, 9.2219, 25.2528, 55.3644],
      [52.5, 13.4, -33.9, 18.6],
      [0, 0, 0, 0],
    ];
    for (const [a, b, c, d] of pairs) {
      const expected = Math.round(getDistance({ latitude: a, longitude: b }, { latitude: c, longitude: d }) / 1000);
      expect(calculateGeodesicDistanceKm(a, b, c, d)).toBe(expected);
    }
  });

  it('memoizes flight routes per airport pair', () => {
    expect(resolveFlightRoute('STR', 'PMI')).toBe(resolveFlightRoute('str', 'pmi'));
  });
});
