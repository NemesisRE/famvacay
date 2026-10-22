import { describe, it, expect } from 'vitest';
import {
  isOverlandReachable,
  getAvailableVehicles,
  calculateVehicleMetrics,
  OVERLAND_MAX_GEODESIC_KM,
} from './vehicles';
import { getDestinationVacationStyles } from './destinations';
import { optimizeVacationWindows } from './engine';
import { TripPlanInput } from './types';

describe('Travel Vehicles & Dynamic Overland Connectivity', () => {
  it('correctly validates overland reachable routes without hardcoding', () => {
    const karlsruheOrigin = {
      lat: 49.0069,
      lon: 8.4037,
      countryCode: 'DE',
      state: 'DE-BW',
    };

    // Continental Europe overland destinations
    const innsbruck = { lat: 47.2602, lon: 11.344, countryCode: 'AT', state: 'AT-7', code: 'INN' };
    const paris = { lat: 49.0097, lon: 2.5479, countryCode: 'FR', state: 'FR-IDF', code: 'CDG' };
    const zurich = { lat: 47.4582, lon: 8.5555, countryCode: 'CH', state: 'CH-ZH', code: 'ZRH' };

    expect(isOverlandReachable(karlsruheOrigin, innsbruck)).toBe(true);
    expect(isOverlandReachable(karlsruheOrigin, paris)).toBe(true);
    expect(isOverlandReachable(karlsruheOrigin, zurich)).toBe(true);

    // Oceanic islands and sea-separated territories
    const tenerife = { lat: 28.0445, lon: -16.5725, countryCode: 'ES', state: 'ES-CN', code: 'TFS' };
    const mallorca = { lat: 39.5517, lon: 2.7388, countryCode: 'ES', state: 'ES-IB', code: 'PMI' };
    const crete = { lat: 35.3397, lon: 25.1803, countryCode: 'GR', state: 'GR-M', code: 'HER' };
    const cyprus = { lat: 34.8751, lon: 33.6249, countryCode: 'CY', code: 'LCA' };
    const miami = { lat: 25.7959, lon: -80.287, countryCode: 'US', state: 'US-FL', code: 'MIA' };

    expect(isOverlandReachable(karlsruheOrigin, tenerife)).toBe(false);
    expect(isOverlandReachable(karlsruheOrigin, mallorca)).toBe(false);
    expect(isOverlandReachable(karlsruheOrigin, crete)).toBe(false);
    expect(isOverlandReachable(karlsruheOrigin, cyprus)).toBe(false);
    expect(isOverlandReachable(karlsruheOrigin, miami)).toBe(false);
  });

  it('validates American and Australian domestic overland travel dynamically', () => {
    // Miami to Orlando (same landmass, ~330 km)
    const miamiOrigin = { lat: 25.7959, lon: -80.287, countryCode: 'US', state: 'US-FL' };
    const orlando = { lat: 28.4294, lon: -81.309, countryCode: 'US', state: 'US-FL', code: 'MCO' };
    const nassauBahamas = { lat: 25.039, lon: -77.4662, countryCode: 'BS', code: 'NAS' };

    expect(isOverlandReachable(miamiOrigin, orlando)).toBe(true);
    expect(isOverlandReachable(miamiOrigin, nassauBahamas)).toBe(false);

    // Sydney to Canberra vs Auckland
    const sydneyOrigin = { lat: -33.9461, lon: 151.1772, countryCode: 'AU', state: 'AU-NSW' };
    const canberra = { lat: -35.3069, lon: 149.195, countryCode: 'AU', state: 'AU-ACT', code: 'CBR' };
    const auckland = { lat: -37.0082, lon: 174.785, countryCode: 'NZ', code: 'AKL' };

    expect(isOverlandReachable(sydneyOrigin, canberra)).toBe(true);
    expect(isOverlandReachable(sydneyOrigin, auckland)).toBe(false);
  });

  it('computes available vehicles based on distance and overland reachability', () => {
    const karlsruheOrigin = { lat: 49.0069, lon: 8.4037, countryCode: 'DE', state: 'DE-BW' };
    const innsbruck = { lat: 47.2602, lon: 11.344, countryCode: 'AT', state: 'AT-7', code: 'INN' };
    const tenerife = { lat: 28.0445, lon: -16.5725, countryCode: 'ES', state: 'ES-CN', code: 'TFS' };

    const innsbruckVehicles = getAvailableVehicles(karlsruheOrigin, innsbruck, 310);
    expect(innsbruckVehicles).toContain('PLANE');
    expect(innsbruckVehicles).toContain('CAR');
    expect(innsbruckVehicles).toContain('TRAIN');
    expect(innsbruckVehicles).toContain('BUS');

    const tenerifeVehicles = getAvailableVehicles(karlsruheOrigin, tenerife, 3200);
    expect(tenerifeVehicles).toEqual(['PLANE']);
  });

  it('calculates realistic travel metrics for cars, trains, and buses', () => {
    // 400 km family trip
    const carMetrics = calculateVehicleMetrics('CAR', 400, 2.5);
    expect(carMetrics.vehicle).toBe('CAR');
    expect(carMetrics.distanceKm).toBe(500); // 400 * 1.25
    expect(carMetrics.durationMinutes).toBeGreaterThan(300); // ~6.5 hours
    expect(carMetrics.estimatedTravelCost).toBeGreaterThan(150); // Fuel + tolls
    expect(carMetrics.isOverlandReachable).toBe(true);

    const trainMetrics = calculateVehicleMetrics('TRAIN', 400, 2.0);
    expect(trainMetrics.vehicle).toBe('TRAIN');
    expect(trainMetrics.co2KgEstimate).toBeLessThan(carMetrics.co2KgEstimate!); // Eco-friendly
    expect(trainMetrics.isOverlandReachable).toBe(true);
  });

  it('deduplicates vacation styles so Innsbruck does not receive duplicate Alpine & Mountain tags', () => {
    const styles = getDestinationVacationStyles('INN', 310);
    // Ensure styles array does NOT have duplicate ALPINE tags
    const alpineCount = styles.filter((s) => s === 'ALPINE').length;
    expect(alpineCount).toBe(1);
    expect(styles).not.toContain('SKI'); // Redundant SKI tag removed
  });

  it('constrains search to overland destinations when CAR is selected', () => {
    const carSearchInput: TripPlanInput = {
      durationDaysMin: 7,
      durationDaysMax: 7,
      durationDays: 7,
      earliestDate: '2026-11-01',
      latestDate: '2026-11-20',
      travelVehicle: 'CAR',
      userProfile: {
        homeLocation: 'Karlsruhe, Germany',
        departureLat: 49.0069,
        departureLon: 8.4037,
        federalState: 'DE-BW',
        originAirports: ['FKB', 'STR'],
        adults: 2,
        childrenAges: [8],
        blackoutRanges: [],
      },
    };

    const windows = optimizeVacationWindows(carSearchInput, {}, {});
    expect(windows.length).toBeGreaterThan(0);

    for (const win of windows) {
      expect(win.travelVehicle).toBe('CAR');
      // No oceanic island airports like TFS (Tenerife) or PMI (Mallorca) allowed for CAR
      expect(['TFS', 'PMI', 'LPA', 'ACE', 'FUE', 'HER', 'LCA']).not.toContain(win.destinationAirport);
      // Overland trips start at home and carry no flight logistics
      expect(win.originAirport).toBe('HOME');
      expect(win.flightDistanceKm).toBeUndefined();
      expect(win.flightSegments).toBeUndefined();
      // Road distance stays within the car's overland range (road km ~ 1.25x geodesic)
      expect(win.vehicleDetails!.distanceKm).toBeLessThanOrEqual(Math.round(OVERLAND_MAX_GEODESIC_KM.CAR * 1.25));
    }
  });

  it('supports multi-vehicle selection such as CAR and TRAIN simultaneously', () => {
    const multiVehicleInput: TripPlanInput = {
      durationDaysMin: 7,
      durationDaysMax: 7,
      durationDays: 7,
      earliestDate: '2026-11-01',
      latestDate: '2026-11-20',
      travelVehicles: ['CAR', 'TRAIN'],
      userProfile: {
        homeLocation: 'Karlsruhe, Germany',
        departureLat: 49.0069,
        departureLon: 8.4037,
        federalState: 'DE-BW',
        originAirports: ['FKB', 'STR'],
        adults: 2,
        childrenAges: [8],
        blackoutRanges: [],
      },
    };

    const windows = optimizeVacationWindows(multiVehicleInput, {}, {});
    expect(windows.length).toBeGreaterThan(0);

    for (const win of windows) {
      expect(['CAR', 'TRAIN']).toContain(win.travelVehicle);
      // Islands should be excluded for overland multi-selection
      expect(['TFS', 'PMI', 'LPA', 'HER', 'LCA']).not.toContain(win.destinationAirport);
      expect(win.flightDistanceKm).toBeUndefined();
      expect(win.vehicleDetails!.distanceKm).toBeLessThanOrEqual(Math.round(OVERLAND_MAX_GEODESIC_KM.CAR * 1.25));
    }
  });
});


