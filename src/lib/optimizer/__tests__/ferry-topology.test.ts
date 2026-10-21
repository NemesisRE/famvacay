import { describe, it, expect } from 'vitest';
import {
  classifyOverlandAccess,
  getAvailableVehicles,
  calculateVehicleMetrics,
  isOverlandReachable,
  OriginGeoPoint,
  DestinationGeoPoint,
} from '../vehicles';

const DE_ORIGIN: OriginGeoPoint = { lat: 49.0, lon: 8.4, countryCode: 'DE', state: 'DE-BW' };

describe('overlandAccess classification', () => {
  it('classifies mainland/bridge-connected destinations with no surcharge or penalty', () => {
    const munich: DestinationGeoPoint = { lat: 48.1, lon: 11.6, countryCode: 'DE', state: 'DE-BY', code: 'MUC' };
    expect(classifyOverlandAccess(munich)).toEqual({
      access: 'MAINLAND_OR_BRIDGE',
      ferrySurchargeEur: 0,
      ferryTransitMinutes: 0,
    });
  });

  it('classifies Corfu as SHORT_FERRY (+140 EUR, +120 min)', () => {
    const corfu: DestinationGeoPoint = { lat: 39.6, lon: 19.9, countryCode: 'GR', code: 'CFU' };
    expect(classifyOverlandAccess(corfu)).toEqual({
      access: 'SHORT_FERRY',
      ferrySurchargeEur: 140,
      ferryTransitMinutes: 120,
    });
  });

  it('classifies Corsica and Bornholm as LONG_FERRY (+380 EUR)', () => {
    const corsica: DestinationGeoPoint = { lat: 42.0, lon: 9.0, countryCode: 'FR', state: 'FR-COR', code: 'AJA' };
    expect(classifyOverlandAccess(corsica).access).toBe('LONG_FERRY');
    expect(classifyOverlandAccess(corsica).ferrySurchargeEur).toBe(380);

    const bornholm: DestinationGeoPoint = { lat: 55.1, lon: 14.9, countryCode: 'DK', code: 'RNN' };
    expect(classifyOverlandAccess(bornholm).access).toBe('LONG_FERRY');
  });

  it('classifies Canary Islands and non-Corfu Greek islands as FLIGHT_ONLY', () => {
    const tenerife: DestinationGeoPoint = { lat: 28.0, lon: -16.6, countryCode: 'ES', state: 'ES-CN', code: 'TFS' };
    expect(classifyOverlandAccess(tenerife).access).toBe('FLIGHT_ONLY');

    const crete: DestinationGeoPoint = { lat: 35.3, lon: 25.2, countryCode: 'GR', code: 'HER' };
    expect(classifyOverlandAccess(crete).access).toBe('FLIGHT_ONLY');
  });
});

describe('getAvailableVehicles with ferry-reachable islands', () => {
  it('keeps CAR/TRAIN overland-viable for a SHORT_FERRY island (Corfu) within distance caps', () => {
    const corfu: DestinationGeoPoint = { lat: 39.6, lon: 19.9, countryCode: 'GR', code: 'CFU' };
    const vehicles = getAvailableVehicles(DE_ORIGIN, corfu, 900);
    expect(vehicles).toContain('PLANE');
    expect(vehicles).toContain('CAR');
    expect(vehicles).toContain('TRAIN');
  });

  it('keeps CAR overland-viable for a LONG_FERRY island (Corsica) within distance caps', () => {
    const corsica: DestinationGeoPoint = { lat: 42.0, lon: 9.0, countryCode: 'FR', state: 'FR-COR', code: 'AJA' };
    expect(isOverlandReachable(DE_ORIGIN, corsica)).toBe(true);
    const vehicles = getAvailableVehicles(DE_ORIGIN, corsica, 900);
    expect(vehicles).toContain('CAR');
  });

  it('prunes CAR/TRAIN/BUS entirely for a FLIGHT_ONLY island (Canary Islands)', () => {
    const tenerife: DestinationGeoPoint = { lat: 28.0, lon: -16.6, countryCode: 'ES', state: 'ES-CN', code: 'TFS' };
    const vehicles = getAvailableVehicles(DE_ORIGIN, tenerife, 2800);
    expect(vehicles).toEqual(['PLANE']);
  });
});

describe('calculateVehicleMetrics ferry surcharge', () => {
  it('adds the SHORT_FERRY surcharge and transit buffer to CAR metrics', () => {
    const base = calculateVehicleMetrics('CAR', 900, 1.0, false);
    const withFerry = calculateVehicleMetrics('CAR', 900, 1.0, false, {
      access: 'SHORT_FERRY',
      ferrySurchargeEur: 140,
      ferryTransitMinutes: 120,
    });
    expect(withFerry.estimatedTravelCost - base.estimatedTravelCost).toBe(140);
    expect(withFerry.durationMinutes - base.durationMinutes).toBe(120);
  });

  it('adds the LONG_FERRY surcharge and crossing time to CAR metrics', () => {
    const base = calculateVehicleMetrics('CAR', 900, 1.0, false);
    const withFerry = calculateVehicleMetrics('CAR', 900, 1.0, false, {
      access: 'LONG_FERRY',
      ferrySurchargeEur: 380,
      ferryTransitMinutes: 360,
    });
    expect(withFerry.estimatedTravelCost - base.estimatedTravelCost).toBe(380);
    expect(withFerry.durationMinutes - base.durationMinutes).toBe(360);
  });
});
