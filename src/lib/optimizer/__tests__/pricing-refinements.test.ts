import { describe, it, expect } from 'vitest';
import { getChildFareMultiplier, calculatePassengerCostMultiplier } from '../child-tiers';
import {
  calculateRoomOccupancyMultiplier,
  calculatePackageTourComparison,
} from '../../pricing/pricing-service';

describe('Haul-dependent child flight fares', () => {
  it('falls back to the legacy flat 0.75 rate when no distance is given', () => {
    expect(getChildFareMultiplier(undefined)).toBe(0.75);
  });

  it('charges 0.95 of adult fare on short/medium-haul (< 4,500 km) LCC routes', () => {
    expect(getChildFareMultiplier(850)).toBe(0.95);
    expect(getChildFareMultiplier(3000)).toBe(0.95);
    expect(getChildFareMultiplier(4499)).toBe(0.95);
  });

  it('charges 0.75 of adult fare on long-haul (>= 4,500 km) full-service routes', () => {
    expect(getChildFareMultiplier(4500)).toBe(0.75);
    expect(getChildFareMultiplier(8700)).toBe(0.75);
  });

  it('keeps infants at 0.10 and applies the haul-dependent rate for children in the full multiplier', () => {
    // 2 adults (2.0) + 1 infant (0.10) + 1 child at short-haul (0.95) = 3.05
    const shortHaul = calculatePassengerCostMultiplier(2, [1, 7], { distanceKm: 1200 });
    expect(shortHaul).toBeCloseTo(3.05, 2);

    // 2 adults (2.0) + 1 child at long-haul (0.75) = 2.75
    const longHaul = calculatePassengerCostMultiplier(2, [7], { distanceKm: 6000 });
    expect(longHaul).toBeCloseTo(2.75, 2);
  });
});

describe('Hotel room occupancy topology (step function)', () => {
  it('stays at 1.0x for up to 2 adults + 1 child (+ max 1 infant)', () => {
    expect(calculateRoomOccupancyMultiplier(2, [7]).multiplier).toBe(1.0);
    expect(calculateRoomOccupancyMultiplier(2, [7, 1]).multiplier).toBe(1.0); // + infant <2y
  });

  it('steps up to 1.35x for 2 adults + 2 non-infant children', () => {
    const result = calculateRoomOccupancyMultiplier(2, [7, 9]);
    expect(result.multiplier).toBe(1.35);
    expect(result.propertyType).toMatch(/Studio|Superior/);
  });

  it('steps up to 1.85x for 3+ non-infant children', () => {
    expect(calculateRoomOccupancyMultiplier(2, [5, 7, 9]).multiplier).toBe(1.85);
  });

  it('steps up to 1.85x when total travelers (excl. infants) reach 5, even with only 2 children', () => {
    expect(calculateRoomOccupancyMultiplier(3, [7, 9]).multiplier).toBe(1.85);
  });

  it('does not count infants toward the non-infant-children occupancy cliff', () => {
    expect(calculateRoomOccupancyMultiplier(2, [1, 1, 7]).multiplier).toBe(1.0);
  });
});

describe('Package Tour Child Fixed-Price Discount (Kinderfestpreis)', () => {
  it('returns undefined for non-package-tour destinations', () => {
    expect(calculatePackageTourComparison('JFK', 800, 700, 2, [7, 9])).toBeUndefined();
  });

  it('returns undefined when there are no non-infant children', () => {
    expect(calculatePackageTourComparison('PMI', 800, 700, 2, [])).toBeUndefined();
    expect(calculatePackageTourComparison('PMI', 800, 700, 2, [1])).toBeUndefined();
  });

  it('computes the package vs. modular comparison for a DACH package-tour destination', () => {
    const result = calculatePackageTourComparison('PMI', 800, 700, 2, [7, 9]);
    expect(result).toBeDefined();
    expect(result!.isPackageTourDestination).toBe(true);
    expect(result!.childFixedPriceEur).toBe(149);
    expect(result!.modularPriceEur).toBe(1500);
    expect(result!.packagePriceEur).toBe(988);
    expect(result!.cheaperStrategy).toBe('PACKAGE');
    expect(result!.savingsEur).toBe(512);
  });
});
