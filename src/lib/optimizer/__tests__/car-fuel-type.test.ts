import { describe, it, expect } from 'vitest';
import { calculateVehicleMetrics, CAR_FUEL_PROFILES } from '../vehicles';
import { optimizeVacationWindows } from '../engine';
import type { CarFuelType, TripPlanInput } from '../types';

describe('Car drivetrain cost model', () => {
  const ROAD_GEODESIC_KM = 800; // ~1000 km by road

  it('keeps the legacy blended estimate when no drivetrain is given', () => {
    const m = calculateVehicleMetrics('CAR', ROAD_GEODESIC_KM, 1);
    expect(m.fuelType).toBeUndefined();
    expect(m.estimatedTravelCost).toBe(Math.round(1000 * 2 * 0.2 + 45));
  });

  it('prices energy from consumption and unit price, round trip', () => {
    for (const fuel of ['PETROL', 'DIESEL', 'ELECTRIC'] as CarFuelType[]) {
      const m = calculateVehicleMetrics('CAR', ROAD_GEODESIC_KM, 1, false, undefined, fuel);
      const p = CAR_FUEL_PROFILES[fuel];
      expect(m.fuelType).toBe(fuel);
      expect(m.energyCostEur).toBe(Math.round(((m.distanceKm * 2) / 100) * p.consumptionPer100Km * p.unitPriceEur));
    }
  });

  it('diesel and electric are cheaper to run than petrol; electric emits far less CO2', () => {
    const petrol = calculateVehicleMetrics('CAR', ROAD_GEODESIC_KM, 1, false, undefined, 'PETROL');
    const diesel = calculateVehicleMetrics('CAR', ROAD_GEODESIC_KM, 1, false, undefined, 'DIESEL');
    const ev = calculateVehicleMetrics('CAR', ROAD_GEODESIC_KM, 1, false, undefined, 'ELECTRIC');
    expect(diesel.estimatedTravelCost).toBeLessThan(petrol.estimatedTravelCost);
    expect(ev.estimatedTravelCost).toBeLessThan(petrol.estimatedTravelCost);
    expect(ev.co2KgEstimate!).toBeLessThan(petrol.co2KgEstimate! / 2);
  });

  it('adds fast-charging stops to electric road trips', () => {
    const ev = calculateVehicleMetrics('CAR', ROAD_GEODESIC_KM, 1, false, undefined, 'ELECTRIC');
    const petrol = calculateVehicleMetrics('CAR', ROAD_GEODESIC_KM, 1, false, undefined, 'PETROL');
    expect(ev.chargingStops).toBe(3); // 1000 km / 280 km legs -> 3 stops after a full start
    expect(ev.durationMinutes).toBe(petrol.durationMinutes + 3 * 20);
    expect(petrol.chargingStops).toBeUndefined();

    const shortEv = calculateVehicleMetrics('CAR', 150, 1, false, undefined, 'ELECTRIC');
    expect(shortEv.chargingStops).toBe(0);
  });

  it('flows through the optimizer for car candidates', () => {
    const input = (carFuelType?: CarFuelType): TripPlanInput => ({
      targetDestinations: ['Lloret de Mar'],
      durationDays: 7,
      earliestDate: '2027-07-01',
      latestDate: '2027-07-07',
      travelVehicles: ['CAR'],
      carFuelType,
      userProfile: {
        homeLocation: 'Karlsruhe',
        departureLat: 49.0069,
        departureLon: 8.4037,
        federalState: 'DE-BW',
        originAirports: [],
        childrenAges: [],
        blackoutRanges: [],
      },
    });
    const [ev] = optimizeVacationWindows(input('ELECTRIC'), {}, {});
    const [petrol] = optimizeVacationWindows(input('PETROL'), {}, {});
    expect(ev.vehicleDetails?.fuelType).toBe('ELECTRIC');
    expect(ev.vehicleDetails!.chargingStops!).toBeGreaterThan(0);
    expect(ev.estimatedTotalCost).toBeLessThan(petrol.estimatedTotalCost);
    expect(ev.vehicleDetails!.durationMinutes).toBeGreaterThan(petrol.vehicleDetails!.durationMinutes);
  });
});
