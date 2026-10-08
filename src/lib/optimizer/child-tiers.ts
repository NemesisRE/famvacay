import { ChildPassenger, ChildAgeTier } from './types';

/**
 * Categorize child age into pricing tiers:
 * infant (<2 yrs), child (2–11 yrs), teen (12+ yrs)
 */
export function getChildAgeTier(age: number): ChildAgeTier {
  if (age < 2) return 'infant';
  if (age <= 11) return 'child';
  return 'teen';
}

export function parseChildrenAges(ages: number[]): ChildPassenger[] {
  return ages.map((age) => ({
    age,
    tier: getChildAgeTier(age),
  }));
}

/**
 * Calculate age-adjusted passenger multiplier.
 * Infants usually fly with lap fee (~10%), children get child fare (~75%), teens/adults pay 100%.
 */
export function calculatePassengerCostMultiplier(adultsCount: number, childrenAges: number[]): number {
  let multiplier = adultsCount * 1.0;
  for (const age of childrenAges) {
    const tier = getChildAgeTier(age);
    if (tier === 'infant') {
      multiplier += 0.10;
    } else if (tier === 'child') {
      multiplier += 0.75;
    } else {
      multiplier += 1.0;
    }
  }
  return multiplier;
}

