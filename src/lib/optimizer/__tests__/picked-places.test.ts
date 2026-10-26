import { describe, it, expect, afterEach } from 'vitest';
import {
  dynamicDestinationEntityCache,
  getDestinationEntity,
  resolveDestinationTargets,
  type LocalizedDestinationEntity,
} from '../destinations';
import { getDestinationPoint } from '../../geo/destination-points';
import { placeDestinationCode } from '../../geo/surface-destinations';
import { isPlausibleItinerary, resolveFlightRoute } from '../../airports/flight-routes';
import type { TravelVehicle } from '../types';

const names = (n: string) => ({ en: n, de: n, fr: n, es: n, it: n });
const entity = (id: string, airportCodes: string[], place?: LocalizedDestinationEntity['place']): LocalizedDestinationEntity => ({
  id,
  category: 'city',
  airportCodes,
  countryCode: 'DE',
  place,
  names: names(id),
  countryNames: names('Germany'),
});

// Eggenstein-Leopoldshafen, next to Karlsruhe
const home = (vehicles: TravelVehicle[]) => ({ departureLat: 49.0897, departureLon: 8.3937, country: 'DE', federalState: 'DE-BW', travelVehicles: vehicles });

describe('Towns the user picks as destinations', () => {
  afterEach(() => dynamicDestinationEntityCache.clear());

  it('encodes a town as its own destination point', () => {
    const code = placeDestinationCode({ lat: 50.7085, lon: 10.7253, region: 'DE-TH', name: 'Oberhof' });
    const point = getDestinationPoint(code)!;
    expect(point.kind).toBe('SURFACE');
    expect(point.city).toBe('Oberhof');
    expect(point.state).toBe('DE-TH');
    expect(point.country).toBe('Germany');
    expect(point.lat).toBeCloseTo(50.7085, 3);
  });

  it('drives to the town itself and flies only to an airport that serves it', () => {
    dynamicDestinationEntityCache.set('oberhof', entity('oberhof', ['ERF', 'FRA', 'DUS'], { lat: 50.7085, lon: 10.7253, region: 'DE-TH' }));

    const overland = resolveDestinationTargets(['Oberhof'], 'ALL', home(['CAR', 'TRAIN', 'BUS']));
    expect(overland.codes).toHaveLength(1);
    expect(getDestinationPoint(overland.codes[0])?.city).toBe('Oberhof');

    const all = resolveDestinationTargets(['Oberhof'], 'ALL', home(['PLANE', 'CAR', 'TRAIN', 'BUS']));
    // Erfurt serves Oberhof; Frankfurt is next door to home, Düsseldorf ~300 km from Oberhof
    expect(all.codes.filter((c) => c.length === 3)).toEqual(['ERF']);
    expect(all.flightOnly.has('ERF')).toBe(true);
  });

  it('never resolves a name by part of another cached name', () => {
    dynamicDestinationEntityCache.set('city of amsterdam', entity('city_of_amsterdam', ['ALB']));
    expect(getDestinationEntity('Amsterdam')?.airportCodes ?? []).not.toContain('ALB');
  });
});

describe('Plausible flight itineraries', () => {
  it('rejects absurd detours on short trips but allows hub connections on long ones', () => {
    const viaPalma = { ...resolveFlightRoute('FKB', 'ERF'), segments: [{ departureAirport: 'FKB', arrivalAirport: 'PMI', distanceKm: 1250, durationMinutes: 120 }, { departureAirport: 'PMI', arrivalAirport: 'ERF', distanceKm: 1600, durationMinutes: 150 }] };
    expect(isPlausibleItinerary(viaPalma, 290)).toBe(false);
    const viaDubai = { ...viaPalma, segments: [{ departureAirport: 'FRA', arrivalAirport: 'DXB', distanceKm: 4840, durationMinutes: 380 }, { departureAirport: 'DXB', arrivalAirport: 'DPS', distanceKm: 7900, durationMinutes: 560 }] };
    expect(isPlausibleItinerary(viaDubai, 11935)).toBe(true);
  });
});
