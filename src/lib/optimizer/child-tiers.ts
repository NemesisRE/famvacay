import { differenceInYears, parseISO } from 'date-fns';

export type AgeCategory = 'INFANT' | 'CHILD' | 'ADULT';

export interface ChildPassenger {
  age: number;
  tier: 'infant' | 'child' | 'teen';
}

/**
 * Derives the exact passenger age category for a specific travel date.
 * - INFANT: Under 2 years on the travel date.
 * - CHILD: 2 to 11 years (inclusive).
 * - ADULT: 12 years and older (standard airline fare rules).
 */
export function deriveAgeCategory(
  birthDate: string | Date,
  travelDate: string | Date
): AgeCategory {
  const bDate = typeof birthDate === 'string' ? parseISO(birthDate) : birthDate;
  const tDate = typeof travelDate === 'string' ? parseISO(travelDate) : travelDate;

  const age = differenceInYears(tDate, bDate);
  if (age < 2) return 'INFANT';
  if (age <= 11) return 'CHILD';
  return 'ADULT';
}

/**
 * Derives segment-aware passenger age categories.
 * Crucial rule: If a child is an INFANT (<2) on outbound departure,
 * but turns 2 before or on the return segment date, the return segment MUST use CHILD.
 */
export function deriveSegmentAgeCategories(
  birthDate: string | Date,
  outboundDate: string | Date,
  returnDate: string | Date
): {
  outboundTier: AgeCategory;
  returnTier: AgeCategory;
  turnedTwoDuringTrip: boolean;
} {
  const outboundTier = deriveAgeCategory(birthDate, outboundDate);
  const returnTier = deriveAgeCategory(birthDate, returnDate);

  const turnedTwoDuringTrip = outboundTier === 'INFANT' && returnTier === 'CHILD';

  return {
    outboundTier,
    returnTier,
    turnedTwoDuringTrip,
  };
}

/**
 * Legacy backwards-compatible tier mapper for numeric age.
 */
export function getChildAgeTier(age: number): 'infant' | 'child' | 'teen' {
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
 * Long-haul threshold (km) above which full-service network carriers operate and charge the
 * standard ~75% child fare. Below this, low-cost/leisure carriers dominate and charge 95%-100%
 * of the adult base fare for children aged 2-11 (child seats still occupy full seat capacity).
 */
export const LONG_HAUL_THRESHOLD_KM = 4500;

/**
 * Haul-dependent child (2-11) fare multiplier.
 * - Short/medium-haul (< 4,500 km, typical LCC/leisure routes): 0.95 of adult base fare.
 * - Long-haul (>= 4,500 km, full-service network carriers): 0.75 of adult base fare.
 * When distanceKm is omitted, falls back to the legacy flat 0.75 rate (used for non-flight contexts).
 */
export function getChildFareMultiplier(distanceKm?: number): number {
  if (distanceKm == null) return 0.75;
  return distanceKm >= LONG_HAUL_THRESHOLD_KM ? 0.75 : 0.95;
}

/**
 * Calculate age-adjusted passenger multiplier.
 * Infants fly with a lap fee (~10%). Children (2-11) pay a haul-dependent fare: 95% on
 * short/medium-haul LCC routes, 75% on long-haul full-service carriers. Teens/adults pay 100%.
 * Supports segment-aware child birthdays during travel.
 */
export function calculatePassengerCostMultiplier(
  adultsCount: number,
  childrenAges: number[],
  segmentOptions?: {
    birthDates?: (string | Date)[];
    outboundDate?: string;
    returnDate?: string;
    distanceKm?: number;
  }
): number {
  let multiplier = adultsCount * 1.0;
  const childFare = getChildFareMultiplier(segmentOptions?.distanceKm);

  if (
    segmentOptions?.birthDates &&
    segmentOptions.outboundDate &&
    segmentOptions.returnDate
  ) {
    for (const bDate of segmentOptions.birthDates) {
      const { outboundTier, returnTier } = deriveSegmentAgeCategories(
        bDate,
        segmentOptions.outboundDate,
        segmentOptions.returnDate
      );

      // Average outbound and return fare multipliers for the round trip
      const outboundCost = outboundTier === 'INFANT' ? 0.10 : outboundTier === 'CHILD' ? childFare : 1.0;
      const returnCost = returnTier === 'INFANT' ? 0.10 : returnTier === 'CHILD' ? childFare : 1.0;
      multiplier += (outboundCost + returnCost) / 2;
    }
  } else {
    for (const age of childrenAges) {
      const tier = getChildAgeTier(age);
      if (tier === 'infant') {
        multiplier += 0.10;
      } else if (tier === 'child') {
        multiplier += childFare;
      } else {
        multiplier += 1.0;
      }
    }
  }

  return multiplier;
}
